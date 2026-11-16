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

## Müşteri Hesabı Güvenliği (Faz 12)

- **Oturum Çerezi ve JWT İptali:** Medusa `emailpass` JWT'si tarayıcıya verilmez; Next.js BFF tarafından `alte_customer_session` adlı `httpOnly`, `SameSite=Lax`, üretimde `Secure` çerezi (7 gün) içinde tutulur. Sunucu tarafında `customer_session` (`session_id`, `token_version`, `revoked_at`, `expires_at`) tablosu tutulur; çıkış, şifre değişikliği, şifre sıfırlama veya hesap silme işlemlerinde oturum/sürüm iptal edilir (`sessionGuard` her istekte doğrular).
- **Kullanıcı Numaralandırma ve Zamanlama Tabanı:** Kayıt, giriş ve şifre sıfırlama uç noktaları tek tip yanıt gövdesi döner ve `ACCOUNT_RESPONSE_FLOOR_MS` (varsayılan 900 ms) sabit zaman tabanı uygular. Giriş, kayıt, şifre sıfırlama ve doğrulama uç noktaları IP + e-posta bazlı hız sınırına tabidir.
- **CSRF / Origin Koruması:** Durum değiştiren tüm `/api/account/*` uç noktaları `Origin`/`Host` doğrulaması yapar; `NEXT_PUBLIC_SERVER_URL` dışındaki kökenler HTTP 403 ile reddedilir. `/hesap/*` rotaları `Referrer-Policy: no-referrer` ve `X-Robots-Tag: noindex, nofollow` başlıklarıyla servis edilir.
- **E-posta Doğrulama ve Misafir Sipariş Birleştirme:** Doğrulama ve şifre sıfırlama token'ları yalnızca SHA-256 hash olarak saklanır, tek kullanımlık ve sürelidir. Doğrulanmamış hesaplar geçmiş misafir siparişlerini otomatik bağlayamaz; birleştirme yalnızca e-posta doğrulandıktan sonra gerçekleşir.
- **Hesap Silme, Anonimleştirme ve Mali Kayıtlar:** Hesap silmede müşteri kimliği anonimleştirilir (`deleted-...`), oturumlar iptal edilir ve `has_account=false` yapılır; vergi/muhasebe mevzuatı gereği geçmiş sipariş ve fatura kayıtları anonimleştirilmiş referansla saklanır. **İnsan onayı gerekli:** Mali/sipariş kayıtlarının kesin saklama süresi canlıya çıkmadan önce avukat ve muhasebeci tarafından onaylanmalıdır (Faz 9).
- **WooCommerce Kancası:** Eski parolalar `customer.metadata` içinde tutulmaz; ayrı ve `AES-256-GCM` şifreli `customer_legacy_credential` tablosunda (`email_lookup` HMAC ile) tutulur ve API yanıtlarında asla dönmez. `LegacyVerifierRegistry` üretimde boştur ve test algoritmalarını reddeder.
- **Ters Vekil / IP Çıkarma (`TRUST_PROXY` & `TRUSTED_PROXY_HOPS`):** `extractClientIp` (`apps/web/src/lib/security/origin-guard.ts`) fail-closed çalışır. `TRUST_PROXY` açık (`true`/`1`) değilken hiçbir istemci başlığına (`X-Real-IP`, `X-Forwarded-For`, `Forwarded`) güvenilmez ve sabit `"unknown"` döner. `TRUST_PROXY=true` iken yalnızca `X-Forwarded-For` başlığının sondan `TRUSTED_PROXY_HOPS` (varsayılan `1`) sıradaki girdisi alınır ve IPv4/IPv6 (`node:net` `isIP`) doğrulamasından geçemeyen değerler `"unknown"` kabul edilir. OpenLiteSpeed / CyberPanel gibi ters vekillerde istemcinin gönderdiği `X-Forwarded-For` / `X-Real-IP` başlıkları vekil tarafından üzerine yazılmıyorsa `TRUST_PROXY` kapalı kalmalıdır.
- **E-posta Başına IP'den Bağımsız Hız Sınırları & Bellek Sınırı:**
  - `loginIpEmailGuard`: `IP:email` başına 15 dakikada 5 hatalı deneme -> 15 dk kilit (`429`). Başarılı giriş yalnızca `IP:email` sayacını sıfırlar.
  - `loginEmailGuard`: Tüm IP'ler genelinde e-posta başına 15 dakikada 20 hatalı deneme -> 15 dk kilit (`429`). Başarılı giriş bu sayacı sıfırlamaz.
  - `loginIpLimiter`: IP başına 15 dakikada 30 istek.
  - `registerEmailLimiter`: E-posta başına 60 dakikada 5 istek (`registerIpLimiter`: IP başına 60 dk 5 istek).
  - `resetEmailLimiter`: E-posta başına 60 dakikada 3 istek (`resetIpLimiter`: IP başına 60 dk 10 istek).
  - `resendVerificationCustomerLimiter`: Müşteri başına 60 dakikada 3 istek.
  - `FixedWindowRateLimiter` ve `BruteForceGuard`: `maxEntries` (varsayılan `10_000`) sınırına ulaşıldığında süresi dolanları sildikten sonra en eski kayıtları FIFO sırasıyla temizler; bellek kullanımı sınırlıdır.

## 10. Faz 12.3 Sertleştirme Kararları

- **SEC-027 — SMTP Host Doğrulaması (Yalnızca Link-Local / Metadata Engeli):** `admin/email-settings` ve `admin/email-settings/test` uç noktaları `isValidHostname` doğrulamasını zorunlu kılar ve test e-postası HTML gövdesinde `settings.host` değerini `escapeHtml()` ile kaçırır. Üretimde (`NODE_ENV === "production"`) yalnızca link-local ve bulut metadata aralıkları (`169.254.0.0/16`, `fe80::/10`, `100.64.0.0/10`) reddedilir. `127.0.0.1` ve RFC1918 özel ağ adresleri (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) **bilerek engellenmez**; çünkü üretimde yerel Postfix/SMTP rölesi aynı sunucuda veya özel iç ağda çalışabilir.
- **SEC-029 — Parola Doğrulamalı Uç Noktalarda İki Kademeli Hız Sınırı:** `/store/account/password` ve `/store/account/delete` uç noktalarında `customerId` başına hatalı "mevcut parola" denemeleri iki kademeli korunur:
  - **1. Kademe (5 hatalı deneme):** `429 Too Many Requests` ve 15 dakika bekleme uygulanır; gerçek müşterinin yanlış tuşlama nedeniyle oturumu hemen düşürülmez.
  - **2. Kademe (10 hatalı/engelli deneme):** Tüm aktif müşteri oturumları (`revokeAllCustomerSessions`) iptal edilir.
- **SEC-028 — Strict Müşteri Oturumu Koruması:** `/store/customers/me`, `/store/orders` ve `/auth/session` rotalarında Bearer token yoksa `401` dönen `strictCustomerSessionGuard` uygulanır; admin JWT'leri (`actor_type !== "customer"`) ve misafir checkout/sipariş takibi akışları etkilenmez.
- **SEC-030 — Çok Adımlı Yazma Bütünlüğü:** Hesap silme (`account/delete`) ve parola değiştirme oturum yenilemesi (`account/password`) tek `pgConnection.transaction` içinde çalışır. Parola sıfırlamada (`password-reset/confirm`) `authService` parola güncellemesi dış transaction'a girmediği için önce parola güncellenir, yalnızca başarılıysa tek `pgConnection.transaction` içinde token tüketilir ve oturumlar iptal edilir.
- **SEC-035 — Üretim CORS ve Hata Yutma Koruması:** `env.ts` üretimde `ADMIN_CORS`, `AUTH_CORS` ve `STORE_CORS` için `*` (wildcard) değerini açılışta reddeder. `admin/payment-settings/manual-refunds` veritabanı hatasında `200` yerine `500` döner.

## 11. Faz 12.4 Güvenlik Denetimi Düzeltmeleri

- **Medusa Admin Girişi Hız Sınırı (`POST /auth/user/emailpass`):**
  - `adminLoginIpEmailGuard`: `IP:hmac(email)` başına **5 hatalı deneme / 15 dk** kilit (`429`). Başarılı giriş yalnızca kendi `IP:hmac(email)` sayacını sıfırlar.
  - `adminLoginEmailGuard`: IP'den bağımsız `hmac(email)` başına **15 hatalı deneme / 15 dk** kilit (`429`).
  - İstemci IP'si `extractMedusaClientIp` ile fail-closed çıkarılır (`TRUST_PROXY` kapalıyken `X-Forwarded-For` / `X-Real-IP` yok sayılır).
  - Yalnızca hatalı (4xx, 429 hariç) denemeler sayılır; başarılı girişler (`200`) sınırlandırılmaz.
- **`/medusa-api/*` Allowlist ve Path Traversal Koruması (`apps/web/next.config.ts` & `apps/web/src/middleware.ts`):**
  - Genel `/medusa-api/:path*` wildcard rewrite kaldırıldı. Yalnızca Medusa Admin (`/app`) arayüzünün gerektirdiği `/medusa-api/admin/:path*`, `/medusa-api/auth/user/:path*`, `/medusa-api/auth/session` ve `/medusa-api/auth/token/refresh` yolları açıldı.
  - Next.js `rewrites()` kodlanmış `%2e%2e` yollarını Medusa'ya iletip Express'in bunları `..` olarak çözmesine yol açabildiği için, `apps/web/src/middleware.ts` (`/medusa-api/:path*`) ham URL yolunu rewrite öncesinde doğrular: `..`, `/.`, `%2e`, `%2f`, `%5c`, `\`, `//`, `%00`, `%25` ve `;` içeren herhangi bir yol `404` ile reddedilir. Ayrı bir proxy route handler yerine `middleware.ts` seçilmiştir; böylece çerez (`Set-Cookie`), gövde akışı ve başlık aktarımı bozulmadan tek noktadan ön-doğrulama yapılır.
  - `/store/*`, `/hooks/*`, `/internal/*` ve `/auth/customer/*` (hem doğrudan hem traversal ile) herkese açık web kökeninden `404` döner.
- **Sipariş Takibi (`POST /store/order-tracking`):**
  - `requireInternalSecret` ile korunur; `siparis-takip` sayfası `x-alte-internal` ve `extractClientIp` ile elde edilen `x-alte-client-ip` başlığını iletir (`getTrustedClientIp` yoksa `"unknown"`).
  - Mevcut IP+sipariş (5 hata / 15 dk) ve IP (10 istek / dk) sınırlarına ek olarak IP'den bağımsız **sipariş numarası başına 20 hatalı deneme / 15 dk** kilidi (`trackingOrderGuard`) uygulanır.
- **Admin Rol Koruması (`admin-role-guard.ts`):**
  - Rol çözülemediğinde veya tanınmadığında fail-closed `403` döner (`role || "admin"` kaldırıldı).
  - `order-operations/*` (iptal, COD tahsilat, not, kargo, CSV) uç noktaları `checkAdminOrShopManagerRole`, `payment-settings/test-connection` ve `manual-refunds` uç noktaları `checkAdminSettingsRole` ile korunur.
  - `setup:store` (`ensureExistingAdminRoles`) `store.metadata.role_backfill_done` kalıcı işaretini kullanır ve ilk kurulumda `metadata.role` olmayan mevcut kullanıcılara **yalnızca bir kez** `super-admin` atar. Sonradan rolsüz açılan kullanıcılar tekrar `setup:store` çalıştırılsa bile rolsüz kalır (`403`); rol ataması açıkça `pnpm admin:set-role -- <e-posta> <rol>` ile yapılır. `/internal/admin-sso` Payload rolünü (`admin` / `super-admin`) Medusa `metadata.role` alanına yazar.
  - **Sınır Notu:** Medusa v2 çekirdeğinde yerleşik rol sistemi bulunmadığından `shop-manager` kısıtı yalnızca özel (`/admin/order-operations/*`, `/admin/contact-messages/*`, `/admin/email-settings/*`, `/admin/payment-settings/*`) rotalarda uygulanır; Medusa çekirdek admin API'si için güvenlik sınırı değildir.
- **CSP, HSTS ve `Permissions-Policy`:**
  - Vitrin yolları için `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https://www.paytr.com; frame-src 'self' https://www.paytr.com` uygulanır; üretimde `'unsafe-eval'`, `localhost`, `127.0.0.1`, `ws:`, `wss:` çıkarılır.
  - `'unsafe-inline'` şimdilik korunmuştur; çünkü Next.js 15'te nonce tabanlı CSP tüm sayfaları dinamik render'a zorlayarak vitrin statik/ISR önbelleğini ve 384 MB bellek bütçesini bozmaktadır (nonce geçişi Faz 13'e bırakılmıştır).
  - `/admin/*` ve `/app/*` yolları kendi yönetim paneli CSP'sini (`default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'`) kullanır. (`/app` harici rewrite üzerinden geldiğinden `next.config.ts` `headers()` yerine `apps/web/src/middleware.ts` üzerinden eklenir.)
  - Üretimde `Strict-Transport-Security: max-age=31536000; includeSubDomains` (preload yok) ve tüm yollarda `Permissions-Policy: camera=(), microphone=(), geolocation=()` gönderilir.
- **Payload Giriş & Parola Sıfırlama Koruması (`POST /api/users/login`, `forgot-password`, `reset-password`):**
  - Next.js App Router Node.js rotası (`(payload)/api/[...slug]/route.ts`) üzerinden `POST /api/users/login`, `POST /api/users/forgot-password` ve `POST /api/users/reset-password` için IP başına **10 istek / 15 dk** (`429` + `Retry-After`) uygulanır (`GET /admin/login` sınırlanmaz).
  - `Users.hooks.afterError` ve yanıt sarmalayıcı (`maskLockedAccountResponse`), Payload'ın `"This user is locked..."` mesajını genel `"The email or password provided is incorrect."` mesajına çevirerek e-posta numaralandırmayı kapatır.
- **Arama Hız Sınırları:**
  - `/api/search/suggestions`: web katmanında `extractClientIp` ile **60 istek / dk** (`429` + `Retry-After`).
  - `/store/search`: güvenilir iç isteklerde `x-alte-client-ip`, doğrudan harici isteklerde `extractMedusaClientIp` ile **60 istek / dk** (`429`).
- **Ödeme Geri Çağrısı & Durum Ucu:**
  - `pp_paytr_paytr`: `status === "success"` iken `expected_amount_kurus` eksik veya `<= 0` ise sepet tamamlanmaz, oturum `needs_manual_review` olarak işaretlenir, PII'siz loglanır ve PayTR'ye `OK` dönülür.
  - `store/checkout-status`: `cart_id` doğrulaması (400/404), sabit Türkçe 500 hata mesajı ve `order_cart` üzerinden filtrelenmiş tekil sorgu kullanılır.
