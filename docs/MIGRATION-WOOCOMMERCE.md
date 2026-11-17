# WooCommerce Geçiş ve Veri Aktarım Rehberi (`MIGRATION-WOOCOMMERCE.md`)

Bu doküman, Faz 10 kapsamında WooCommerce (11.x, HPOS açık) / WordPress (7.x) mağazasından Medusa v2'ye veri aktarımı için şemaları, yalnızca-okuma (`SELECT`) sorgularını, güvenlik kurallarını ve geri dönüş (rollback) adımlarını tanımlar.

---

## 1. Güvenlik Kuralları (Zorunlu)

1. **Sıfır Doğrudan Yazma:** Canlı WordPress/WooCommerce veritabanına yalnızca okuma (`SELECT`) sorgusu çalıştırılır.
2. **Hassas Veri Koruması:** `password_hash` ve müşteri PII alanları içeren CSV dosyaları **kesinlikle** sohbetlere, e-postaya, LLM araçlarına veya Git deposuna yapıştırılmaz.
3. **Dosya Konumu:** Tüm geçici CSV ve rapor dosyaları `.gitignore` içindeki `migration-data/` klasöründe tutulur; işi biten CSV dosyası güvenli biçimde silinir.
4. **Hata Raporları:** `migration-data/reports/` altındaki raporlarda yalnızca maskeli e-posta (`a***@e***.test`) ve satır numarası yer alır; tam e-posta, parola ve hash yazılmaz.

---

## 2. Faz 10.1 — Müşteri ve Şifre CSV Şeması

UTF-8 (başlıklı, RFC-4180 virgülle ayrılmış) CSV sütunları:

`wc_user_id,email,first_name,last_name,phone,billing_first_name,billing_last_name,billing_company,billing_address_1,billing_address_2,billing_city,billing_state,billing_postcode,billing_country,billing_phone,shipping_first_name,shipping_last_name,shipping_company,shipping_address_1,shipping_address_2,shipping_city,shipping_state,shipping_postcode,shipping_country,user_registered,password_hash`

- **Kayıtlı kullanıcılar:** `wc_user_id` dolu (`> 0`), `password_hash` `wp_users.user_pass` değeridir.
- **Misafir müşteriler (`--include-guests`):** `wc_user_id` `0` (veya boş) ve `password_hash` boş bırakılır. Varsayılan çalıştırmada misafir satırları atlanır; `--include-guests` verildiğinde `has_account = false` olarak aktarılır. Aynı e-posta hem kayıtlı hem misafir olarak bulunursa kayıtlı hesap korunur.

### 2.1 Canlı Sunucuda Yalnızca Okuma (`SELECT`) SQL Sorgusu

> **Not:** Tablo öneki `wp_` farklıysa (`wpxy_` vb.) aşağıdaki sorguda güncelleyin.

**Kayıtlı WooCommerce Müşterileri (`customer` rolü):**

```sql
SELECT
  u.ID AS wc_user_id,
  u.user_email AS email,
  COALESCE(MAX(CASE WHEN m.meta_key = 'first_name' THEN m.meta_value END), '') AS first_name,
  COALESCE(MAX(CASE WHEN m.meta_key = 'last_name' THEN m.meta_value END), '') AS last_name,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_phone' THEN m.meta_value END), '') AS phone,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_first_name' THEN m.meta_value END), '') AS billing_first_name,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_last_name' THEN m.meta_value END), '') AS billing_last_name,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_company' THEN m.meta_value END), '') AS billing_company,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_address_1' THEN m.meta_value END), '') AS billing_address_1,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_address_2' THEN m.meta_value END), '') AS billing_address_2,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_city' THEN m.meta_value END), '') AS billing_city,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_state' THEN m.meta_value END), '') AS billing_state,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_postcode' THEN m.meta_value END), '') AS billing_postcode,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_country' THEN m.meta_value END), 'TR') AS billing_country,
  COALESCE(MAX(CASE WHEN m.meta_key = 'billing_phone' THEN m.meta_value END), '') AS billing_phone,
  COALESCE(MAX(CASE WHEN m.meta_key = 'shipping_first_name' THEN m.meta_value END), '') AS shipping_first_name,
  COALESCE(MAX(CASE WHEN m.meta_key = 'shipping_last_name' THEN m.meta_value END), '') AS shipping_last_name,
  COALESCE(MAX(CASE WHEN m.meta_key = 'shipping_company' THEN m.meta_value END), '') AS shipping_company,
  COALESCE(MAX(CASE WHEN m.meta_key = 'shipping_address_1' THEN m.meta_value END), '') AS shipping_address_1,
  COALESCE(MAX(CASE WHEN m.meta_key = 'shipping_address_2' THEN m.meta_value END), '') AS shipping_address_2,
  COALESCE(MAX(CASE WHEN m.meta_key = 'shipping_city' THEN m.meta_value END), '') AS shipping_city,
  COALESCE(MAX(CASE WHEN m.meta_key = 'shipping_state' THEN m.meta_value END), '') AS shipping_state,
  COALESCE(MAX(CASE WHEN m.meta_key = 'shipping_postcode' THEN m.meta_value END), '') AS shipping_postcode,
  COALESCE(MAX(CASE WHEN m.meta_key = 'shipping_country' THEN m.meta_value END), 'TR') AS shipping_country,
  u.user_registered AS user_registered,
  u.user_pass AS password_hash
FROM wp_users u
INNER JOIN wp_usermeta cap
  ON cap.user_id = u.ID
  AND cap.meta_key = 'wp_capabilities'
  AND cap.meta_value LIKE '%"customer"%'
LEFT JOIN wp_usermeta m
  ON m.user_id = u.ID
GROUP BY u.ID, u.user_email, u.user_registered, u.user_pass
ORDER BY u.ID ASC;
```

**İsteğe Bağlı Misafir Müşteriler (HPOS açıkken `wp_wc_orders` + `wp_wc_order_addresses`):**

```sql
SELECT
  0 AS wc_user_id,
  LOWER(TRIM(o.billing_email)) AS email,
  COALESCE(MAX(ba.first_name), '') AS first_name,
  COALESCE(MAX(ba.last_name), '') AS last_name,
  COALESCE(MAX(ba.phone), '') AS phone,
  COALESCE(MAX(ba.first_name), '') AS billing_first_name,
  COALESCE(MAX(ba.last_name), '') AS billing_last_name,
  COALESCE(MAX(ba.company), '') AS billing_company,
  COALESCE(MAX(ba.address_1), '') AS billing_address_1,
  COALESCE(MAX(ba.address_2), '') AS billing_address_2,
  COALESCE(MAX(ba.city), '') AS billing_city,
  COALESCE(MAX(ba.state), '') AS billing_state,
  COALESCE(MAX(ba.postcode), '') AS billing_postcode,
  COALESCE(MAX(ba.country), 'TR') AS billing_country,
  COALESCE(MAX(ba.phone), '') AS billing_phone,
  COALESCE(MAX(sa.first_name), '') AS shipping_first_name,
  COALESCE(MAX(sa.last_name), '') AS shipping_last_name,
  COALESCE(MAX(sa.company), '') AS shipping_company,
  COALESCE(MAX(sa.address_1), '') AS shipping_address_1,
  COALESCE(MAX(sa.address_2), '') AS shipping_address_2,
  COALESCE(MAX(sa.city), '') AS shipping_city,
  COALESCE(MAX(sa.state), '') AS shipping_state,
  COALESCE(MAX(sa.postcode), '') AS shipping_postcode,
  COALESCE(MAX(sa.country), 'TR') AS shipping_country,
  MIN(o.date_created_gmt) AS user_registered,
  '' AS password_hash
FROM wp_wc_orders o
LEFT JOIN wp_wc_order_addresses ba
  ON ba.order_id = o.id AND ba.address_type = 'billing'
LEFT JOIN wp_wc_order_addresses sa
  ON sa.order_id = o.id AND sa.address_type = 'shipping'
WHERE o.customer_id = 0
  AND o.billing_email IS NOT NULL
  AND o.billing_email <> ''
GROUP BY LOWER(TRIM(o.billing_email));
```

---

## 3. Kendi Hesabınızla Yerel Gerçek Doğrulama Adımları

1. Yalnızca kendi WordPress kullanıcı satırınızı (tek satır) yukarıdaki sorgudan (`WHERE u.ID = <kendi_id>`) `migration-data/my-account.csv` dosyasına aktarın.
2. **Kuru çalıştırma:**
   ```bash
   pnpm migrate:customers -- migration-data/my-account.csv
   ```
   Algoritma dağılımını (`wp-bcrypt-sha384: 1` vb.) kontrol edin.
3. **Yerel veritabanına aktarım:**
   ```bash
   pnpm migrate:customers -- migration-data/my-account.csv --apply --confirm-database medusa_db
   ```
4. Tarayıcıda `http://localhost:3100/hesap/giris` sayfasına gidin ve **mevcut WordPress parolanızla** giriş yapın.
5. Girişin başarılı olduğunu doğrulayın, ardından çıkış yapıp aynı parolayla **ikinci kez** giriş yapın (artık Medusa `emailpass` üzerinden çalışır ve `customer_legacy_credential` satırı silinmiştir).
6. İşlem bitince `migration-data/my-account.csv` dosyasını silin. **Gerçek hash'i hiçbir zaman sohbete veya repoya koymayın.**

---

## 4. Üretime Alma ve Geri Dönüş (Rollback)

### Üretime Alma Sırası

1. `pnpm migrate:customers -- migration-data/customers.csv` ile kuru çalıştırma ve hata raporunu inceleyin.
2. Bakım modunu açtıktan sonra üretim DB adını doğrulayarak çalıştırın:
   ```bash
   NODE_ENV=production pnpm migrate:customers -- migration-data/customers.csv --apply --confirm-database <prod_db_adi> --allow-production
   ```
   (Misafir müşteriler de dahil edilecekse `--include-guests` ekleyin.)
3. İşlem sonrası `migration-data/customers.csv` dosyasını güvenli biçimde silin.

### Geri Dönüş (Rollback)

İçe aktarılan müşteri kayıtları `metadata->>'migrated_from' = 'woocommerce'` ile işaretlenir. Yalnızca henüz oturum/sipariş açmamış taşınan kayıtları geri almak için önce kuru sayım yapın:

```sql
-- 1. Kuru kontrol (kaç kayıt etkilenecek):
SELECT COUNT(*) FROM customer WHERE metadata->>'migrated_from' = 'woocommerce';

-- 2. Geri alma (transaction içinde):
BEGIN;
DELETE FROM customer_legacy_credential
 WHERE customer_id IN (SELECT id FROM customer WHERE metadata->>'migrated_from' = 'woocommerce');
DELETE FROM customer_account_state
 WHERE customer_id IN (SELECT id FROM customer WHERE metadata->>'migrated_from' = 'woocommerce');
DELETE FROM customer_address
 WHERE customer_id IN (SELECT id FROM customer WHERE metadata->>'migrated_from' = 'woocommerce');
DELETE FROM customer
 WHERE metadata->>'migrated_from' = 'woocommerce';
COMMIT;
```
