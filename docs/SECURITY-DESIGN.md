# Güvenlik Tasarımı ve İlkeleri (SECURITY-DESIGN.md)

Bu doküman, sistemin güvenlik mimarisini, veri erişim denetimlerini, kimlik doğrulama politikalarını, ödeme güvenliğini ve WAF kurallarını tanımlar.

---

## 1. Public Depo ve Gizli Bilgi Yönetimi

Depo herkese açık (Public) olduğu için güvenlik standartları "Sıfır Güven" (Zero-Trust) esasına dayanır:

1. **Sıfır Fallback Secret Kuralı (Fail-Closed):**
   - Kod tabanında hiçbir secret için varsayılan/fallback değer (`|| "default_secret"`) yer almaz.
   - Gerekli ortam değişkeni eksikse uygulama başlatma anında Zod şeması ile hata fırlatarak çöker (`throw new Error`).
2. **Commit ve Geçmiş Hijyeni:**
   - Pre-commit hook'ta yerel `gitleaks protect --staged` çalıştırılır.
   - GitHub Actions CI üzerinde `gitleaks/gitleaks-action` tüm git geçmişini tarar; tek bir sızıntıda build kırılır.
3. **Konfigürasyon Şablonları:**
   - `.env*` dosyaları `.gitignore` ile dışlanır; depoda yalnızca boş yer tutuculu `.env.example` dosyaları commit edilir.

---

## 2. Erişim Denetimi ve Rol İlkeleri (RBAC)

Payload CMS 3 üzerinde Users koleksiyonu **yalnızca personel ve yönetim kadrosu içindir**. Müşteri hesapları, oturumları, sepet ve sipariş geçmişi tamamen Medusa v2 Auth & Customer altyapısında tutulur.

- **Payload CMS Rol Hiyerarşisi (Yalnızca Personel):**
  1. `super-admin`: Sistem genelinde tam yetki (kullanıcı rolü değiştirme, silme, yapılandırma).
  2. `admin`: Mağaza ve CMS yönetimi, personel kullanıcıları oluşturma ve yönetme.
  3. `shop-manager`: Ürün, sipariş, stok ve kargo yönetimi.
  4. `editor`: Tüm sayfa, blog ve medya içeriklerini düzenleme ve yayınlama.
  5. `author`: Yalnızca kendi yazdığı blog içeriklerini düzenleme.
- **Anonim Kayıt Yasağı:** Users koleksiyonunda anonim kayıt (`Users.create`) kapalıdır. Yeni kullanıcılar yalnızca mevcut bir `admin` veya `super-admin` tarafından oluşturulabilir.
- **Yetki Sınırları ve Ayrımı:** `super-admin` rolünü yalnızca mevcut bir `super-admin` atayabilir veya değiştirebilir. `admin` rolündeki kullanıcılar `super-admin` kullanıcıları düzenleyemez, silemez ve kendi rollerini `super-admin` seviyesine yükseltemez.
- **İlk Süper Admin ve Üretim Kuralı:** İlk kurulum için CLI bootstrap scripti (`pnpm create-admin`) kullanılır. Üretimde önce `pnpm create-admin` çalıştırılmadan /admin dışarı açılmaz.
- **Müşteri Hesapları:** Müşteriler Payload CMS'te yer almaz (`customer` rolü Payload'dan ve `@alte/shared` rol sabitlerinden tamamen kaldırılmıştır). Müşteriler Medusa v2 Storefront API (`/store/customers`, `/auth/customer/emailpass`) üzerinden yönetilir.

---

## 3. Hız Sınırlaması (Rate Limiting) Planı

Kritik uç noktalara yönelik kaba kuvvet (brute-force) ve DoS saldırılarını engellemek için Redis tabanlı kayan pencere (sliding-window) hız sınırlaması uygulanır:

| Uç Nokta                          | Metot |  Pencere  | Maksimum İstek | Aşım Yanıtı                                   |
| :-------------------------------- | :---: | :-------: | :------------: | :-------------------------------------------- |
| `/api/users/login`                | POST  | 15 dakika |    5 deneme    | `429 Too Many Requests` (10 dk hesap kilidi)  |
| `/api/users/register`             | POST  |  1 saat   |    3 deneme    | `429 Too Many Requests`                       |
| `/store/carts/*/payment-sessions` | POST  | 1 dakika  |    10 istek    | `429 Too Many Requests`                       |
| `/store/carts/*/discounts`        | POST  | 1 dakika  |    5 istek     | `429 Too Many Requests` (Kupon deneme engeli) |

---

## 4. Ödeme Güvenliği, Şifreleme ve Callback Doğrulaması

Ödeme akışında istemci tarafı (tarayıcı) verilerine **kesinlikle güvenilmez**:

- Tutar, vergi ve sepet tutarı yalnızca Medusa sunucusunda hesaplanır ve PayTR token isteğine sunucu tarafından aktarılır.
- Sipariş durumu, yalnızca PayTR sunucusundan gelen imzalı callback (webhook) ile `completed` durumuna geçer.
- **AES-256-GCM ile Veri Şifreleme:** PayTR Merchant Key ve Merchant Salt bilgileri veritabanında asla açık tutulmaz; `SETTINGS_ENCRYPTION_KEY` ile AES-256-GCM (12-byte IV, 16-byte auth tag) algoritmasıyla şifrelenir.
- **Write-Only Admin:** Admin API ve UI üzerinden hassas anahtarlar asla açık metin dönülmez (`••••••••••••••••6789`).
- **TC Kimlik No Yasağı:** KVKK ve gizlilik standartları gereği misafir veya kayıtlı checkout akışında TC Kimlik No kesinlikle talep edilmez, kaydedilmez ve loglanmaz.

### PayTR Callback Güvenlik Adımları (`POST /hooks/payment/pp_paytr_paytr`):

1. **İmza Hesaplama:**
   PayTR tarafından gönderilen `merchant_oid`, `status` ve `total_amount` değerleri, sunucuda şifresi çözülen `merchant_salt` ve `merchant_key` ile birleştirilerek HMAC-SHA256 imzası hesaplanır:
   $$\text{hash\_str} = \text{merchant\_oid} + \text{merchant\_salt} + \text{status} + \text{total\_amount}$$
   $$\text{expected\_hash} = \text{base64}(\text{hmac\_sha256}(\text{hash\_str}, \text{merchant\_key}))$$
2. **Sabit Zamanlı Karşılaştırma (Timing Attack Prevention):**
   Gelen `hash` ile hesaplanan imza `crypto.timingSafeEqual()` fonksiyonu ile sabit sürede karşılaştırılır.
3. **Tutar Bütünlüğü:**
   PayTR'den dönen `total_amount` (kuruş cinsinden), Medusa sepetindeki beklenen tutara eşit veya büyük olmak zorundadır. Eksik tutar durumunda sepet kapatılmaz.
4. **Idempotency (Mükerrer İstek Koruması):**
   Aynı `merchant_oid` için mükerrer bir callback gelirse, sipariş yeniden işleme alınmaz; doğrudan PayTR'a `"OK"` yanıtı dönülür.
5. **PayTR Yanıt Protokolü:**
   Başarılı veya durumu loglanan bildirimlerde yanıt gövdesi yalnızca ve kesinlikle yalın `"OK"` metni olmalıdır (boşluk, HTML veya JSON PayTR tarafından hata kabul edilir).

---

## 5. WAF / ModSecurity Kontrol Listesi (PayTR Uyumluluğu)

Üretim sunucusunda OpenLiteSpeed / ModSecurity veya Cloudflare WAF kullanıldığında PayTR bildirimlerinin engellenmemesi için aşağıdaki kurallar zorunludur:

- [ ] **Callback Rota İstisnası:** `/hooks/payment/pp_paytr_paytr` rotası için POST gövdesi denetim kuralları (`SecRuleEngine DetectionOnly` veya whitelist) uygulanmalıdır.
- [ ] **User-Agent Kontrolü:** ModSecurity varsayılan kuralları (OWASP CRS), boş veya standart dışı `User-Agent` içeren istekleri (örneğin PayTR botunu) engelleyebilir. Callback rotasında User-Agent kuralı bypass edilmelidir.
- [ ] **IP Whitelist Kontrolü (Doğrulanması gereken):** PayTR teknik destek tarafından paylaşılan resmi bildirim IP blokları güvenlik duvarında beyaz listeye alınmalıdır.
- [ ] **Hız Sınırlaması İstisnası:** Callback rotası genel müşteri rate limit kurallarından muaf tutulmalı, yalnızca PayTR sunucu IP'lerine açık olmalıdır.

---

## 6. Bilinen Bağımlılık İstisnaları (Known Security Exceptions)

`pnpm audit --prod --audit-level=high` sonucu **0 yüksek / 0 kritik açık** ile temizdir. Üretim bağımlılıklarında kalan orta ve düşük seviyeli 2 bulgu aşağıda teknik gerekçeleriyle listelenmiştir:

1. **`uuid <11.1.1` (Moderate - GHSA-w5hq-g745-h8pq):**
   - **Yol:** `apps/medusa > @medusajs/medusa > @medusajs/event-bus-redis > bullmq@5.13.0 > uuid@9.0.1`
   - **Gerekçe:** Güvenlik açığı, `uuid` kütüphanesinin v3/v5/v6 metotlarına kullanıcı kontrolündeki harici `buffer` sağlandığında sınır denetimi eksikliğinden kaynaklanır. BullMQ yalnızca dahili iş (job) kimlikleri için `uuid.v4()` çağırır; harici buffer kabul etmez. BullMQ v5, `uuid` major sürümünü yükseltmediği için `pnpm.overrides` ile zorlanması durumunda ESM/CJS uyumsuzluğu riski vardır. Mevcut kullanım bağlamında istismar edilemez.
2. **`deepmerge <=4.3.1` (Low - GHSA-gcqx-w48m-w2h4):**
   - **Yol:** `apps/web > @payloadcms/db-postgres > @payloadcms/drizzle > payload@3.93.0 > deepmerge@4.3.1` ve `@sendgrid/helpers > deepmerge@4.3.1`
   - **Gerekçe:** `deepmerge` kütüphanesinin prototip kirlenmesi (prototype pollution) zafiyeti olup, upstream geliştirici tarafından henüz yamalanmamıştır (`Patched versions: <0.0.0`). Payload CMS ve SendGrid dahili nesne birleştirmede kullanmakta olup, girdi doğrulama Zod şemaları ve Payload strict collection tanımlarıyla sınırlandırılmıştır. Upstream yama yayınlandığında güncellenecektir.
