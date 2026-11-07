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

Payload CMS 3 üzerinde tüm koleksiyon ve global nesneler için varsayılan kural **"kapalı" (default-closed)** ilkesidir:

- **Rol Hiyerarşisi:**
  1. `super-admin`: Sistem genelinde tam yetki (kullanıcı rolü değiştirme, silme, yapılandırma).
  2. `admin`: Mağaza ve CMS yönetimi.
  3. `shop-manager`: Ürün, sipariş, stok ve kargo yönetimi.
  4. `editor`: Tüm sayfa, blog ve medya içeriklerini düzenleme ve yayınlama.
  5. `author`: Yalnızca kendi yazdığı blog içeriklerini düzenleme.
  6. `customer`: Varsayılan rol. Yalnızca kendi müşteri profilini ve sipariş geçmişini görüntüleyebilir.
- **Anonim Erişim Yasağı:** Kimliği doğrulanmamış (ziyaretçi) kullanıcılar Users koleksiyonundan hiçbir veri okuyamaz.
- **Yetki Yükseltme Koruması (Privilege Escalation):** Kayıt sırasında veya müşteri profil güncellemesinde `role` alanı sunucu tarafında kilitlenmiştir; sadece `admin` veya `super-admin` tarafından güncellenebilir.

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

## 4. Ödeme Güvenliği ve Callback Doğrulaması

Ödeme akışında istemci tarafı (tarayıcı) verilerine **kesinlikle güvenilmez**:

- Tutar, vergi ve sepet tutarı yalnızca Medusa sunucusunda hesaplanır ve PayTR token isteğine sunucu tarafından aktarılır.
- Sipariş durumu, yalnızca PayTR sunucusundan gelen imzalı callback (webhook) ile `completed` durumuna geçer.

### PayTR Callback Güvenlik Adımları:

1. **İmza Hesaplama:**
   PayTR tarafından gönderilen `merchant_oid`, `status` ve `total_amount` değerleri, sunucuda saklanan `merchant_salt` ve `merchant_key` ile birleştirilerek HMAC-SHA256 imzası hesaplanır:
   $$\text{hash\_str} = \text{merchant\_oid} + \text{merchant\_salt} + \text{status} + \text{total\_amount}$$
   $$\text{expected\_hash} = \text{base64}(\text{hmac\_sha256}(\text{hash\_str}, \text{merchant\_key}))$$
2. **Sabit Zamanlı Karşılaştırma (Timing Attack Prevention):**
   Gelen `hash` ile hesaplanan imza `crypto.timingSafeEqual()` fonksiyonu ile sabit sürede karşılaştırılır.
3. **Tutar Bütünlüğü:**
   PayTR'den dönen `total_amount` (kuruş cinsinden), Medusa sepetindeki beklenen tutarla kuruşu kuruşuna eşleşmek zorundadır.
4. **Idempotency (Mükerrer İstek Koruması):**
   Aynı `merchant_oid` için mükerrer bir callback gelirse, sipariş yeniden işleme alınmaz; doğrudan PayTR'a `"OK"` yanıtı dönülür.
5. **PayTR Yanıt Protokolü:**
   Başarılı doğrulamada yanıt gövdesi yalnızca yalın `"OK"` metni olmalıdır (boşluk, HTML veya JSON PayTR tarafından hata kabul edilir).

---

## 5. WAF / ModSecurity Kontrol Listesi (PayTR Uyumluluğu)

Üretim sunucusunda OpenLiteSpeed / ModSecurity veya Cloudflare WAF kullanıldığında PayTR bildirimlerinin engellenmemesi için aşağıdaki kurallar zorunludur:

- [ ] **Callback Rota İstisnası:** `/api/payment/paytr/callback` rotası için POST gövdesi denetim kuralları (`SecRuleEngine DetectionOnly` veya whitelist) uygulanmalıdır.
- [ ] **User-Agent Kontrolü:** ModSecurity varsayılan kuralları (OWASP CRS), boş veya standart dışı `User-Agent` içeren istekleri (örneğin PayTR botunu) engelleyebilir. Callback rotasında User-Agent kuralı bypass edilmelidir.
- [ ] **IP Whitelist Kontrolü (Doğrulanması gereken):** PayTR teknik destek tarafından paylaşılan resmi bildirim IP blokları güvenlik duvarında beyaz listeye alınmalıdır.
- [ ] **Hız Sınırlaması İstisnası:** Callback rotası genel müşteri rate limit kurallarından muaf tutulmalı, yalnızca PayTR sunucu IP'lerine açık olmalıdır.
