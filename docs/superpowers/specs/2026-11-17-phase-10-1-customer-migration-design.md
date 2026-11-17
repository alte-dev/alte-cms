# Faz 10.1 — WooCommerce Müşteri ve Şifre Taşıma Tasarımı

**Tarih:** 2026-11-17
**Dal:** `phase-10-1-customer-migration`
**Kapsam:** Yalnızca müşteri + şifre taşıma ve sonraki alt fazlar (`10.2` katalog/301, `10.3` siparişler) için ortak CSV içe aktarma çerçevesi.

---

## 1. Üretim Parola Doğrulayıcıları (`apps/medusa/src/modules/customer-account/verifiers/`)

### 1.1 Desteklenen Algoritmalar

| `algorithm`        | Hash Biçimi                         | Doğrulama Yöntemi                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :----------------- | :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wp-bcrypt-sha384` | `$wp$2y$...` (WordPress 6.8+ / 7.x) | Parola >4096 bayt ise `false`. `$wp` öneki kaldırılır, `base64(HMAC-SHA384(parola, "wp-sha384"))` (ham bayt HMAC → standart base64, 64 karakter) hesaplanır, `$2y$` → `$2b$` dönüşümüyle `bcryptjs.compare` çalıştırılır. Kaynak doğrulaması: `WordPress/wordpress-develop` `trunk/src/wp-includes/pluggable.php` satır 2824 ve 2871–2874 (`wp_check_password` içinde `trim` uygulanmaz, `hash_hmac('sha384', $password, 'wp-sha384', true)` kullanılır). |
| `bcrypt`           | `$2y$`, `$2a$`, `$2b$`              | `$2y$` → `$2b$` dönüşümüyle `bcryptjs.compare` (PHP `password_verify` ile aynı 72 bayt UTF-8 sınırı).                                                                                                                                                                                                                                                                                                                                                     |
| `phpass`           | `$P$`, `$H$`                        | Saf JS taşınabilir phpass uygulaması (`itoa64`, yineleme sayısı `2^n`, 8 karakter tuz, MD5 döngüsü, `crypto.timingSafeEqual`). Ek dış bağımlılık riski sıfır.                                                                                                                                                                                                                                                                                             |
| `md5`              | 32 karakter hex                     | Yalnızca doğrulama (yeni hash üretimi yok), `crypto.timingSafeEqual` ile sabit zamanlı karşılaştırma.                                                                                                                                                                                                                                                                                                                                                     |

### 1.2 Güvenlik Kuralları

- `bcryptjs` (`3.0.3`, tam sürüm pinli, native derleme yok) `apps/medusa/package.json` `dependencies` altına eklenir.
- `detectLegacyAlgorithm(hash)`: saf fonksiyon; boş, >255 karakter, NUL (`\0`) içeren veya tanınmayan girdilerde `null` döner.
- Tüm doğrulayıcılar `defaultLegacyVerifierRegistry` içinde kayıtlıdır (`test`/`fake-test`/`test-*` algoritmaları üretimde yasak kalır).
- Hata durumunda fail-closed `false` döner, istisna fırlatılmaz, parola/hash loglanmaz.

---

## 2. Ortak İçe Aktarma Çerçevesi ve Müşteri İçe Aktarma (`scripts/migration/`)

### 2.1 Ortak Çerçeve (Faz 10.2 / 10.3 tarafından yeniden kullanılacak)

- `csv-stream.ts`: `fs.createReadStream` tabanlı RFC-4180 uyumlu akış okuyucu (sabit bellek, UTF-8 BOM temizliği).
- `batch-runner.ts`: Parti başına (varsayılan 200 satır) tek PostgreSQL transaction yönetimi.
- `db-guard.ts`: `--apply` olmadan hiçbir yazım yapmaz; `--apply` ile `--confirm-database <db_adi>` zorunlu, `NODE_ENV=production` iken ek `--allow-production` zorunlu.
- `report.ts`: `migration-data/reports/` altına (`.gitignore` içinde) maskeli rapor yazar (`a***@e***.test`); tam e-posta, hash, parola, ad, telefon, adres rapora ve konsola yazılmaz.
- `sanitize.ts`: E-posta normalizasyonu (`trim().toLowerCase()`), NUL/kontrol karakteri temizliği, alan uzunluğu doğrulaması, CSV formül enjeksiyonu (`=`, `+`, `-`, `@`, `\t`, `\r` önekleri) koruması.

### 2.2 Müşteri İçe Aktarma (`pnpm migrate:customers`)

- **Varsayılan davranış:** Yalnızca kayıtlı WordPress kullanıcıları (`wp_users` / `customer` rolü) işlenir.
- **`--include-guests` bayrağı:** İsteğe bağlı olarak misafir müşteri satırlarını (`wc_user_id` boş/`0` ve `password_hash` boş) Medusa `customer` tablosuna `has_account: false`, `metadata: { migrated_from: "woocommerce", wc_guest: true }` ve adresleriyle aktarır (`customer_account_state` ve `customer_legacy_credential` oluşturulmaz). Aynı e-posta hem kayıtlı hem misafir olarak gelirse kayıtlı olan korunur.
- **Kayıtlı müşteri aktarımı:** `has_account: true`, `metadata: { migrated_from: "woocommerce", wc_user_id }`, adresler, `customer_account_state` (`email_verified_at: null`), tanınan hash varsa `customer_legacy_credential` (`AES-256-GCM` şifreli hash + `HMAC-SHA256` `email_lookup`). Tanınmayan/boş hash durumunda müşteri yine aktarılır ve `unsupported_hash` / `missing_hash` sayılır ("şifremi unuttum" ile giriş yapabilir).
- **Idempotency ve e-posta bastırma:** Var olan `has_account: true` müşteriye dokunulmaz (atlanır). Dosya içi yinelenen e-postalar atlanır ve raporlanır. Hiçbir bildirim/hoş geldin/doğrulama e-postası tetiklenmez.
- **Bozuk telefon/adres:** Müşteri yine de içe aktarılır, bozuk alan atlanıp maskeli rapora yazılır.

---

## 3. Giriş, Zayıf Parola Uyarısı, Şifre Sıfırlama ve Kayıt Çakışması

- **Zayıf parola bayrağı (`needs_password_upgrade`):** Legacy giriş başarılı olup parola `validateCustomerPassword(password, email)` kurallarını sağlamıyorsa `customer.metadata.needs_password_upgrade = true` (yalnızca boolean; düz parola asla yazılmaz/loglanmaz).
- `/store/account/me` `needs_password_upgrade: boolean` döner; `/hesap` (`AccountShell`) uyarı bandı gösterir (`/hesap/sifre` bağlantısı).
- `/store/account/password` ve `/store/account/password-reset/confirm` başarıyla tamamlandığında `needs_password_upgrade` temizlenir (`false`).
- **Şifremi unuttum (`password-reset/request`):** Henüz `emailpass` `provider_identity` kaydı olmayan taşınmış `has_account: true` müşteriler için de sıfırlama token'ı üretilip `AuthWorkflowEvents.PASSWORD_RESET` olayı tetiklenir; sıfırlama onayı sonrası yeni `emailpass` kimliği oluşur ve `customer_legacy_credential` silinir.
- **Kayıt çakışması (`register`):** İçe aktarılmış `has_account: true` e-postayla kayıt denemesi uniform `202` döner, ikinci hesap açmaz, `customer_legacy_credential` kaydını değiştirmez.
- **Misafir sipariş bağlama:** E-posta doğrulanmamış kaldığı sürece eski misafir siparişleri hesaba bağlanmaz (Faz 12 kuralı korunur).
