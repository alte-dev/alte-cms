# Faz 12 — Müşteri Hesabı Tasarımı

Durum: taslak (insan onayı bekliyor). Dal: `phase-12-customer-accounts`.

## 1. Amaç ve neden

Müşteriler hesap açıp giriş yapabilsin; profil, adres defteri ve sipariş geçmişini yönetsin. Misafir checkout aynen çalışır. Faz 10'da WooCommerce'ten aktarılacak müşteriler kendi eski siparişlerini görmeli ve ilk girişte WP şifreleriyle girebilmeli; bu fazda bunun kancaları bırakılır.

Bu faz yeni oturum, çerez ve kişisel veri yüzeyi açtığı için güvenlik kritik. Her kural "kabul edilmemeli" ve "kabul edilmeli" yönünden test edilir.

## 2. Hedefler / hedef dışı / başarısızlık sayılanlar

Hedefler:

- Kayıt, giriş, çıkış, e-posta doğrulama, şifre sıfırlama, şifre değiştirme, profil, adres defteri, sipariş geçmişi (liste + detay), hesap silme (anonimleştirme).
- Giriş yapan müşteride checkout formu dolu gelir; misafir sepeti girişte hesaba bağlanır.
- E-posta doğrulandığında aynı e-postayla verilmiş misafir siparişleri hesaba bağlanır.
- KVKK rıza kaydı (ayrı onay kutuları, sürüm + zaman).
- Faz 10 için: doğrulayıcı listesi arayüzü, şifreli eski hash tablosu, sipariş bağlama kancası.
- `scripts/verify-accounts.ts` (gerçek HTTP) `verify:all` içinde.

Hedef dışı:

- WP hash algoritmalarının uygulanması (Faz 10).
- Hız sınırlarının Redis'e taşınması (Faz 13).
- Medusa admin paneline müşteri ekranı ekleme/değiştirme.
- Sosyal giriş, 2FA, "beni hatırla".

Başarısızlık sayılanlar (teknik olarak çalışsa bile):

- Bir müşterinin başka müşterinin sipariş/adres/profilini herhangi bir yoldan görebilmesi.
- Doğrulanmamış hesaba misafir siparişi bağlanması.
- Yanıt içeriği veya süresinden e-postanın kayıtlı olup olmadığının anlaşılması.
- Çıkış sonrası eski çerez/token ile erişim.
- Parola, token, e-posta, ad, adres, telefonun loga/hata mesajına/CSV'ye/yönetici bildirimine düşmesi.
- Misafir checkout veya sipariş takibinin bozulması.

## 3. Kısıtlar

`AGENTS.md` kuralları geçerli: pinli bağımlılık (yeni bağımlılık eklenmesi beklenmiyor), migration ile şema, fail-closed, PII yasakları, sabit marka/alan adı yok, public First Load JS ~110 kB, bellek bütçesi ~1100 MB.

## 4. Yaklaşımlar (seçilen: A)

- **A) Medusa merkezli + web ince BFF — SEÇİLDİ.** Hesap tabloları ve iş kuralları Medusa'da yeni `customer-account` modülünde; web yalnızca httpOnly çerezi taşır, Origin kontrolü yapar, Medusa'ya sunucudan konuşur. Müşteri, sipariş ve eski hash aynı veritabanında; anonimleştirme tek yerde; mevcut AES yardımcısı (`apps/medusa/src/utils/crypto.ts`) burada.
- B) Web merkezli (Payload DB'de oturum/rıza): müşteri verisi iki veritabanına bölünür, atomik anonimleştirme yapılamaz. Reddedildi.
- C) Tarayıcı doğrudan Medusa oturumu (`api.localhost`): kimlik uçlarını tarayıcıya açar, "token tarayıcıya verilmez / web sunucusu konuşur" şartıyla çelişir. Reddedildi.

## 5. İnsanın verdiği kararlar

- Yaklaşım A.
- WooCommerce'ten aktarılan hesaplar eski siparişlerini görür (Faz 10 içe aktarımı siparişleri doğrudan hesaba bağlar; bu faz kancayı sağlar).
- Aynı e-postayla verilmiş misafir siparişleri, e-posta doğrulandıktan sonra hesaba bağlanır (merge). Doğrulanmamışsa bağlanmaz.
- Doğrulanmamış hesap giriş yapabilir, sipariş verebilir ve giriş yapmışken verdiği kendi siparişlerini görür.

## 6. Mimari

```
Tarayıcı ──(httpOnly çerez, Origin)──► Next.js /api/account/* (route handler)
                                         │  X-Alte-Internal: <INTERNAL_API_SECRET>
                                         │  X-Alte-Client-IP: <istemci IP>
                                         │  Authorization: Bearer <müşteri JWT> (oturum varsa)
                                         ▼
                                  Medusa /store/account/*  (özel rotalar)
                                  Medusa /store/customers/me*, /store/orders* (yerleşik)
                                  Medusa ara katmanları (oturum + iç anahtar + sahiplik)
```

### 6.1 Yeni ortam değişkeni

- `INTERNAL_API_SECRET` (web + Medusa, ≥32 karakter, zayıf desen reddi, mevcut `secretValidator` ile). Eksikse iki uygulama da başlamaz (fail-closed). `.env.example` boş yer tutucu, CI'da sahte değer.
- Medusa karşılaştırması sabit zamanlı (`constantTimeCompare`).

### 6.2 Medusa `customer-account` modülü (migration ile, 6 tablo)

| Tablo                         | Alanlar                                                                                                                   | Not                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `customer_account_state`      | `customer_id` (uniq), `email_verified_at` (null), `created_at`                                                            | Doğrulama durumu. `customer.metadata` kullanılmaz (API'de döner).                             |
| `customer_session`            | `id`, `customer_id`, `token_hash` (sha256, uniq), `created_at`, `last_seen_at`, `expires_at`, `revoked_at`                | JWT iptali.                                                                                   |
| `customer_email_verification` | `id`, `customer_id`, `token_hash` (uniq), `expires_at`, `used_at`, `created_at`                                           | Ham token saklanmaz.                                                                          |
| `customer_password_reset`     | `id`, `customer_id`, `token_hash` (uniq), `expires_at`, `used_at`, `created_at`                                           | Medusa reset JWT'sini tek kullanımlık yapar.                                                  |
| `customer_consent`            | `id`, `customer_id`, `consent_type` (`kvkk_notice` / `marketing`), `granted` (bool), `document_version`, `created_at`     | Yalnızca ekleme (append-only). IP saklanmaz.                                                  |
| `customer_legacy_credential`  | `id`, `customer_id` (uniq), `email_lookup` (HMAC-SHA256, uniq), `algorithm`, `hash_encrypted` (AES-256-GCM), `created_at` | Faz 10 doldurur. Hiçbir API yanıtına/loga/CSV'ye girmez. `email_lookup` düz e-posta değildir. |

Hiçbir tablo düz e-posta, ad, telefon, adres veya ham token tutmaz. Token'lar 32 bayt `crypto.randomBytes`, base64url; saklanan değer sha256.

### 6.3 Oturum ve çerez (JWT iptali sorunu)

Sorun: Medusa JWT'si durumsuzdur, sunucuda iptal edilemez.

Çözüm: Giriş yalnızca özel `/store/account/login` üzerinden olur. Bu rota JWT'yi üretir ve `sha256(jwt)`'yi `customer_session` tablosuna yazar. Medusa'da genel bir ara katman, `actor_type=customer` olan her Bearer JWT için (imza `JWT_SECRET` ile doğrulanır) aktif oturum satırı arar: yoksa, iptal edilmişse, `expires_at` geçmişse veya boşta kalma süresi aşılmışsa **401**. Bu, Medusa'nın yerleşik müşteri rotalarının hepsini kapsar. Sonuç: çıkışta satır iptal edilir, token sızsa bile ölü.

- Mutlak ömür: 7 gün (`expires_at`). JWT `exp` de 7 gün (yalnızca müşteri JWT'si; admin `jwtExpiresIn` değişmez).
- Boşta kalma: 24 saat. `last_seen_at` en çok 5 dakikada bir güncellenir (yazma yükü düşük). Bu, "yenileme"dir: aktif kullanımda oturum 7 güne kadar uzar, 24 saat dokunulmazsa düşer.
- Rotasyon: giriş her zaman yeni token üretir (oturum sabitleme yok). Şifre değiştirme ve şifre sıfırlamada müşterinin **tüm** oturumları iptal edilir; şifre değiştirmede mevcut cihaza yeni oturum verilir.
- Hesap silmede tüm oturumlar iptal.
- Çerez: ad `alte_customer_session`, değer JWT, `httpOnly`, `SameSite=Lax`, `Secure` (üretimde `NODE_ENV === "production"` — Chromium/Playwright `http://localhost:3100` için `Secure` çerezi kabul eder), `Path=/`, `Max-Age` = 7 gün. Çıkışta çerez silinir ve sunucu satırı iptal edilir; 401 alan web çerezi siler.
- Medusa `/auth/session` (express-session) müşteri için kullanılmaz; aynı ara katman oturum tablosu kuralını uygular.

### 6.4 Doğrudan Store API'ye karşı kapatma (fail-closed ara katman)

`apps/medusa/src/api/middlewares.ts`:

1. `/auth/customer/*` (register, login, reset-password, update, callback) ve `/auth/token/refresh` müşteri için: geçerli `X-Alte-Internal` yoksa **404**. Böylece parola kuralı, hız sınırı, rıza ve doğrulayıcı listesi atlanamaz. Admin (`/auth/user/*`) etkilenmez.
2. `/store/account/*`: geçerli `X-Alte-Internal` yoksa **404**.
3. `POST /store/customers` (kayıt token'ıyla müşteri oluşturma): iç anahtar yoksa **404**.
4. `GET /store/orders/:id`: Medusa'da kimlik doğrulamasız (sipariş ID bilen herkes PII görür). Yeni kural: (a) geçerli iç anahtar (web `siparis-onay` akışı, `apps/web/src/lib/medusa/cart.ts:453`) veya (b) aktif oturumlu müşteri ve `order.customer_id === actor_id`. Aksi **404** (varlık sızmaz).
5. `/store/orders/:id/transfer/*` (Medusa yerleşik sipariş devri): kullanılmıyor, **404**. Bağlama yalnızca bizim doğrulanmış akışımızla olur.
6. Bearer müşteri JWT'si → oturum tablosu kontrolü (6.3).

Her kural için HTTP testi: yetkisiz red + yetkili kabul.

### 6.5 İstemci IP'si

Hız sınırı Medusa'da uygulanır ama Medusa yalnızca web sunucusunu görür. Web, istemci IP'sini `X-Alte-Client-IP` ile iletir; Medusa bu başlığa **yalnızca geçerli iç anahtar varsa** güvenir. Web tarafında IP: `TRUST_PROXY=true` ise `x-forwarded-for` ilk değeri, değilse `x-real-ip`/bağlantı; yoksa sabit `"unknown"` (tek kova, fail-closed: sınır daha erken devreye girer).

### 6.6 Kimlik doğrulama akışları

Tüm uçlar zod ile doğrulanır. E-posta karşılaştırması `trim().toLowerCase()`.

**Kayıt** `POST /api/account/register` → `/store/account/register`

- Girdi: e-posta, parola, ad, soyad, (telefon opsiyonel), `kvkkNotice: true` (zorunlu), `marketing: boolean` (opsiyonel, ayrı kutu).
- Parola kuralı (6.7) başarısızsa 400 ve alan hatası (bu, hesabın varlığını sızdırmaz; kural e-postadan bağımsız).
- E-posta yeni ise: Medusa emailpass auth identity + customer (`has_account=true`) oluşturulur, `customer_account_state` (doğrulanmamış), rıza satırları, doğrulama token'ı; doğrulama e-postası **olay ile asenkron** gönderilir.
- E-posta kayıtlıysa: hiçbir şey değişmez; sahibine "bu e-postayla kayıt denendi; şifrenizi unuttuysanız sıfırlayın" e-postası asenkron gönderilir.
- Yanıt her iki durumda aynı: `202 {"ok":true,"message":"Kaydınız alındı. Devam etmek için e-posta adresinize gönderilen bağlantıyı kullanın."}`. Otomatik giriş yok (aksi hâlde sızıntı olur). Kullanıcı ardından giriş yapabilir.

**Giriş** `POST /api/account/login` → `/store/account/login`

- Doğrulayıcı listesi (6.9) çalışır. Başarısızsa her durumda aynı: `401 {"error":"E-posta veya parola hatalı."}`.
- Başarılıysa: oturum satırı + JWT; web çerezi yazar; misafir sepeti hesaba bağlanır (6.10); doğrulanmışsa bekleyen misafir siparişleri bağlanır (6.11).

**Çıkış** `POST /api/account/logout`: oturum iptal, çerez silinir. Oturum yoksa da 200 (idempotent).

**E-posta doğrulama** `POST /api/account/verify-email {token}` (sayfa `/hesap/dogrula?token=` formu otomatik değil, kullanıcı butona basar; e-posta tarayıcı önizleyicileri token'ı tüketmesin diye GET tüketmez).

- Token tek kullanımlık (atomik `UPDATE ... SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at > now() RETURNING customer_id`), 24 saat geçerli.
- Başarı: `email_verified_at` yazılır, misafir siparişleri bağlanır (6.11). Geçersiz/süresi geçmiş/kullanılmış: tek tip `400 {"error":"Bağlantı geçersiz veya süresi dolmuş."}`.
- Yeniden gönder: `POST /api/account/verify-email/resend` (oturum gerekir), yeni token önceki aktif token'ları geçersiz kılar.

**Şifre sıfırlama isteği** `POST /api/account/password-reset {email}`

- Web → `/store/account/password-reset/request` → Medusa `generateResetPasswordTokenWorkflow` (yerleşik, var olmayan hesapta hata fırlatmaz). Medusa `auth.password_reset` olayını yayar; **bizim abone** `sha256(token)`'i `customer_password_reset`'e yazar (müşteri e-postadan çözülür) ve mevcut e-posta modülüyle (`email-service.ts` SMTP aktarımı) bağlantıyı gönderir: `${WEB_PUBLIC_URL}/hesap/sifre-sifirla?token=...`.
- Yanıt her zaman `202` aynı metin.
- Ömür: 15 dakika (Medusa `RESET_PASSWORD_TOKEN_TTL_SECONDS = 15 * 60` ile aynı; ikisinden erken dolan geçerlidir).

**Şifre sıfırlama onayı** `POST /api/account/password-reset/confirm {token, password}`

- Parola kuralı → tabloda atomik tüketim (tek kullanımlık) → Medusa emailpass parolası güncellenir → aynı müşterinin diğer aktif sıfırlama token'ları ve **tüm oturumları** iptal edilir. Eski hash varsa silinir (Faz 10 uyumu).
- Geçersiz/süresi geçmiş/ikinci kullanım: tek tip 400.

**Şifre değiştirme** `POST /api/account/password` (oturum + mevcut parola + yeni parola). Mevcut parola doğrulayıcı listesiyle kontrol edilir. Başarıda tüm oturumlar iptal, mevcut cihaza yeni oturum.

### 6.7 Parola kuralları

- En az 10 karakter, en çok 128 (scrypt DoS'una karşı üst sınır).
- Yerel yaygın parola listesi (`apps/medusa/src/modules/customer-account/common-passwords.ts`, ~1000 kayıt, büyük/küçük harf duyarsız; ayrıca e-postanın yerel kısmını içeren parola reddedilir).
- Kural hem web'de (erken geri bildirim) hem Medusa'da (yetkili kontrol) aynı modülden uygulanır; web kopyası `packages/shared`'a konur.
- Parola hiçbir loga/hata mesajına/`console`'a girmez. Web route handler'larında istek gövdesi loglanmaz; Medusa özel rotalarında hata mesajları sabit metinlerdir. Test: verify betiği sunucu loglarında test parolasını arar, bulursa FAIL.

### 6.8 Kullanıcı numaralandırma ve zamanlama

- Kayıt, giriş, sıfırlama, doğrulama yanıtları içerik olarak tek tip (yukarıda).
- Süre: Medusa yalnızca var olan hesapta scrypt çalıştırır. Bu yüzden her hesap uç noktası **sabit alt süreye** yastıklanır: işlem bittikten sonra başlangıçtan itibaren `ACCOUNT_RESPONSE_FLOOR_MS` (varsayılan 900 ms, test ölçümüyle seçilir) dolana kadar beklenir. Ek olarak giriş yolunda hesap yoksa sahte bir scrypt doğrulaması yapılır (iş miktarı eşitlenir). E-postalar olay ile asenkron gönderildiği için süreye eklenmez.
- Kabul ölçütü (verify betiği): kayıtlı ve kayıtsız e-posta için 10'ar istek, medyan fark < 150 ms ve yanıt gövdeleri bayt bayt aynı.

### 6.9 Doğrulayıcı listesi (Faz 10 kancası)

```ts
// apps/medusa/src/modules/customer-account/verifiers/types.ts
export interface LegacyPasswordVerifier {
  readonly algorithm: string; // ör. Faz 10'da "phpass", "wp-bcrypt"
  verify(password: string, legacyHash: string): Promise<boolean>;
}
```

- `LegacyVerifierRegistry`: algoritma → doğrulayıcı. Bu fazda **boş**.
- Giriş sırası: (1) Medusa `emailpass` ile dene. (2) Başarısızsa ve `email_lookup` ile `customer_legacy_credential` satırı varsa, `algorithm` için kayıtlı doğrulayıcı aranır; yoksa başarısız (fail-closed). (3) Doğrulayıcı `true` dönerse: Medusa emailpass kimliği oluşturulur/güncellenir (Medusa biçiminde yeni hash), müşteriye bağlanır, eski satır **silinir**, oturum açılır. Hepsi tek işlemde; silme başarısızsa giriş başarısız.
- `customer_legacy_credential` yazma/okuma yalnızca modül servisinde; hash şifre çözümü yalnızca doğrulama anında, bellekte.
- Testler: arayüz sahte bir test doğrulayıcısıyla (yalnızca test kodunda kayıtlı, "fake-test" algoritması, sahte hash) uçtan uca sınanır: eski hashle giriş → Medusa hash'i oluştu → eski satır silindi → ikinci girişte Medusa yolu kullanıldı. Üretim registry'sine test doğrulayıcısı kaydedilemez (registry `NODE_ENV=production` iken test algoritmasını reddeder; test ile kanıtlanır).
- Faz 10 için ek kanca: `linkOrdersToCustomer(customerId, orderIds)` servis metodu (içe aktarılan geçmiş siparişler).

### 6.10 Sepet ve checkout

- Girişte web, mevcut `cart_id` çerezi varsa Medusa `POST /store/carts/:id/customer` (müşteri JWT'si ile) çağırır; sepet hesaba geçer, `cart_id` çerezi aynı kalır. Hata sepeti silmez; loglanır (PII'siz) ve giriş başarılı kalır.
- Giriş yapmış müşteride `/odeme` formu: e-posta hesap e-postasıyla dolu ve **kilitli** (sunucu, gönderilen e-postayı yok sayar, hesap e-postasını kullanır); kayıtlı adres seçici (varsayılan adres önceden seçili). Misafir akışı değişmez.
- Sipariş müşteri sepetinden oluştuğu için `order.customer_id` hesap müşterisidir; doğrulanmamış hesapta da kendi siparişi geçmişte görünür (insan kararı).

### 6.11 Misafir siparişlerinin bağlanması

- Tetik: e-posta doğrulandığında ve doğrulanmış hesapla her girişte (doğrulamadan sonra verilmiş misafir siparişleri için).
- Kural: `lower(order.email) = lower(customer.email)` VE order'ın müşterisi `has_account=false` olan misafir müşteri VE hesap `email_verified_at IS NOT NULL`. Eşleşen siparişlerin `customer_id`'si hesap müşterisine güncellenir (Medusa order modülü üzerinden). Başka bir `has_account=true` hesaba bağlı sipariş asla taşınmaz.
- Doğrulanmamış hesapta çağrılırsa hiçbir şey yapmaz (servis seviyesinde kontrol + test).

### 6.12 Hesap sayfaları (`/hesap/...`)

`/hesap` (özet), `/hesap/giris`, `/hesap/kayit`, `/hesap/sifre-sifirla`, `/hesap/dogrula`, `/hesap/profil`, `/hesap/adresler`, `/hesap/siparisler`, `/hesap/siparisler/[id]`, `/hesap/sifre`, `/hesap/sil`.

- Hepsi dinamik, `noindex`, sitemap dışı, `Referrer-Policy: no-referrer` (token'lı URL'ler sızmasın).
- Oturum gerektiren sayfalar oturum yoksa `/hesap/giris`'e yönlendirir. Sipariş detayında başkasının siparişi → 404.
- Formlar: etiketli, hata `role="alert"`, klavye ile tamamlanabilir, `autocomplete` öznitelikleri (`email`, `current-password`, `new-password`).
- Hesap sayfaları kendi route segmentinde; public sayfaların First Load JS'ine girmez (ölçülür).
- `hesap` rezerve slug listesine eklenir (`apps/web/src/lib/slugify.ts`, `apps/web/src/app/sitemap.ts`, Payload `Pages` doğrulaması, `AGENTS.md` listesi, testler).
- Navbar'a "Hesabım/Giriş" bağlantısı (sunucu bileşeni, istemci JS eklemez).

### 6.13 Profil, adres, sipariş

- Profil (ad, soyad, telefon) ve adres CRUD + varsayılan: Medusa yerleşik `/store/customers/me` ve `/store/customers/me/addresses[/:id]` (müşteri JWT'si ile; Medusa müşteriye göre kapsıyor). Web üzerinden `PATCH/POST/DELETE /api/account/profile|addresses`.
- E-posta değiştirme bu fazda yok (doğrulama/bağlama karmaşası; hedef dışı).
- Sipariş listesi `/store/orders` (Medusa müşteriye göre filtreliyor), detay `/store/orders/:id` (6.4 sahiplik kuralı). Gösterilen: numara, tarih, durum, kalemler, tutarlar, kargo firması/takip kodu/bağlantısı (mevcut `metadata.tracking_*`).

### 6.14 Hesap silme (KVKK)

`POST /api/account/delete` (oturum + parola onayı + "SİL" yazma onayı).

Tek işlemde:

1. Müşteri: ad → `"Silinmiş"`, soyad → `"Kullanıcı"`, e-posta → `deleted-<rastgele>@anonymized.invalid`, telefon → null, `has_account=false`; tüm adresleri silinir.
2. Aynı e-postaya ait misafir müşteri kayıtları da aynı şekilde anonimleştirilir.
3. Medusa auth identity + emailpass provider identity silinir (giriş imkânsız).
4. Tüm oturumlar iptal, doğrulama/sıfırlama token'ları ve eski hash satırı silinir.
5. Rıza satırları korunur (PII içermez; rıza geçmişinin kanıtı).
6. Siparişler ve mali kayıtlar silinmez; `customer_id` anonim müşteriye bağlı kalır.

> İnsan onayı gerekli (docs'a not düşülür): siparişin kendi içindeki anlık görüntü PII'si (sipariş e-postası, fatura/teslimat adresi) fatura ve vergi mevzuatı gereği saklanabilir; ne kadar süre saklanacağı ve sonra anonimleştirilip anonimleştirilmeyeceği avukat/muhasebeci kararıdır. Kodda süre yazılmaz.

### 6.15 KVKK rıza sürümü

- `kvkk_notice` sürümü: Payload'daki yayımlanmış `kvkk` sayfasının `id` + `updatedAt` değerinden üretilir (`kvkk:<id>:<updatedAt>`); sayfa yayımlanmamışsa (yedek şablon gösteriliyorsa) `kvkk:fallback-template`. Sürüm web sunucusunda kayıt anında okunur ve Medusa'ya iletilir; istemciden gelen sürüme güvenilmez.
- `marketing` sürümü: formda gösterilen pazarlama izni metninin sha256'sının ilk 16 karakteri (`marketing:<hash>`). Metin değişirse sürüm otomatik değişir.
- İki ayrı onay kutusu; KVKK zorunlu, pazarlama opsiyonel ve varsayılan işaretsiz. Pazarlama izni verilmese de `granted=false` satırı yazılır.

### 6.16 Hız sınırı

`order-tracking` içindeki bellek içi Map deseni ortak bir yardımcıya çıkarılır (`apps/medusa/src/utils/rate-limiter.ts`, sabit pencere, süresi dolan kayıtları temizleyen, test edilebilir saat). `order-tracking` bu yardımcıyı kullanacak şekilde davranış değişmeden taşınır (`verify:order-ops` regresyonu).

| Uç nokta                    | Anahtar      | Sınır            | Aşımda |
| --------------------------- | ------------ | ---------------- | ------ |
| login                       | IP + e-posta | 5 hatalı / 15 dk | 429    |
| login                       | IP           | 30 / 15 dk       | 429    |
| register                    | IP           | 5 / saat         | 429    |
| password-reset request      | e-posta      | 3 / saat         | 429    |
| password-reset request      | IP           | 10 / saat        | 429    |
| verify-email, reset confirm | IP           | 10 / 15 dk       | 429    |
| verify-email resend         | müşteri      | 3 / saat         | 429    |

429 yanıtı tek tip ve e-postanın varlığından bağımsızdır (anahtar gönderilen e-postadır, kayıt durumu değil). Anahtarlarda e-posta düz tutulmaz, HMAC'lenir. Çoklu süreçte sınır süreç başınadır (Faz 13'te Redis).

### 6.17 CSRF / Origin

- Web `/api/account/*` içindeki tüm durum değiştiren metotlar (POST/PATCH/PUT/DELETE): `Origin` başlığı izinli köken listesinde olmalı ve `Host` başlığı izinli host ile eşleşmelidir. Liste `NEXT_PUBLIC_SERVER_URL`'den türetilir (Payload `csrf` ayarıyla aynı kaynak; örn. `http://localhost:3100`). `Origin` yoksa veya eşleşmezse red (fail-closed, `403`).
- `SameSite=Lax` çerez ikinci savunma hattıdır.
- Mevcut `/api/cart` ve `/api/checkout` bu fazda değiştirilmez (kapsam dışı).

### 6.18 PII ve loglama

- Web hesap route handler'ları ve Medusa özel rotaları istek gövdesini, e-postayı, adı, telefonu loglamaz. Gerekirse müşteri ID'si ve maskeli e-posta (`maskEmail`) kullanılır.
- Hesap e-postaları (doğrulama, sıfırlama, "zaten kayıtlı") mevcut `email_log` desenine maskeli alıcıyla yazılır; token içermez.
- Yönetici bildirimine hesap olayları gönderilmez.
- CSV dışa aktarma değişmez (zaten PII'siz).

## 7. Doğrulama

`scripts/verify-accounts.ts` (gerçek HTTP, boş DB, web üzerinden; e-postalar mevcut `verify-notifications` desenindeki yerel SMTP yakalayıcıyla alınır):

1. Parola: kısa ve yaygın reddedilir, geçerli kabul edilir.
2. Kayıt (A ve B müşterileri) + kayıtlı e-postayla tekrar kayıt → aynı gövde.
3. Misafir checkout ile A'nın e-postasına sipariş → A doğrulanmamışken giriş → siparişlerde **yok**.
4. A e-posta doğrulama → sipariş **görünür**. Token ikinci kez → red.
5. Yanlış parola → 401; kayıtsız e-posta → aynı 401 gövde; süre farkı ölçümü.
6. Hız sınırı: login IP+e-posta 6. denemede 429.
7. B, A'nın siparişini (`/api/account/orders/:id`, Medusa `/store/orders/:id` doğrudan, iç anahtarsız), adresini (`/store/customers/me/addresses/:idA` B token'ı ile) ve profilini göremez (404/401). A görebilir.
8. Doğrudan Medusa `/auth/customer/emailpass/register` ve `/store/account/*` iç anahtarsız → 404.
9. Şifre sıfırlama: istek → token e-postadan → onay başarılı → aynı token ikinci kez red → süresi geçmiş token (DB'de `expires_at` geçmişe çekilir) red → eski oturum çerezi artık 401.
10. CSRF: yanlış/eksik Origin → 403; doğru Origin → kabul.
11. Çıkış sonrası eski çerez → 401 (web ve doğrudan Medusa Bearer).
12. Sepet bağlama: misafir sepeti + giriş → sepet müşteriye bağlı.
13. Hesap silme → profil anonim, adres yok, giriş 401, siparişler duruyor ve PII'siz müşteriye bağlı.
14. Sunucu loglarında test parolası/e-postası aranır → bulunmamalı.

Ayrıca: birim testleri (parola kuralı, rate limiter, token, doğrulayıcı registry, Origin kontrolü, rezerve slug), `verify:quality` axe taramasına `/hesap/giris` ve `/hesap/kayit`, canlı tarayıcı klavye testi (kayıt/giriş/çıkış). `verify:all` + `live-verify` CI'a bağlanır; `INTERNAL_API_SECRET` CI env'e sahte değerle eklenir. Dokümantasyon güncellemeleri: `docs/PERMISSIONS.md`, `docs/SECURITY-DESIGN.md`, `docs/RUNBOOK.md`, `docs/PHASES.md`.

## 8. Builder'a bırakılanlar

Dosya/klasör yerleşimi, UI görünümü (mevcut Tailwind stiline uygun), yaygın parola listesinin kaynağı (lisansı uygun, kamuya açık liste; kaynak dosyada belirtilir), yastık süresinin ölçümle ince ayarı, test yardımcıları.
