# Mağaza Geneli Varsayılan Kargo Profili & Ücretsiz Kargoda Ücretli Kargoları Gizleme Planı

**Dal:** `fix/shipping-profile-and-free-shipping`

## 1. Mağaza Geneli Varsayılan Kargo Profili

- **Backend API (`apps/medusa/src/api/admin/shipping-profiles/default-policy/route.ts`):**
  - `GET`: Tüm `shipping_profile` kayıtlarını ve hangisinin `metadata.apply_to_all_products === true` olduğunu döner (`checkAdminOrShopManagerRole` ile korumalı).
  - `POST`: Seçilen `shipping_profile_id` için `metadata.apply_to_all_products` bayrağını günceller (diğer profillerden kaldırır) ve isteğe bağlı olarak (`apply_to_existing: true`) `product_shipping_profile` kaydı olmayan (veya tüm) mevcut ürünlere bu profili atar (`checkAdminSettingsRole` ile korumalı).
- **Otomatik Atama (`apps/medusa/src/subscribers/product-default-shipping-profile.ts` + `middlewares.ts`):**
  - `product.created` olayında ürünün `product_shipping_profile` kaydı yoksa mağaza geneli işaretli profili (`apply_to_all_products === true`, yoksa `type === 'default'`) otomatik olarak `product_shipping_profile` tablosuna bağlar.
  - `POST /admin/products` middleware'i (`assignDefaultShippingProfile`) de `shipping_profile_id` boşsa aynı profili gövdeye ekler (hem senkron API hem async subscriber güvencesi).
- **Admin UI (`apps/medusa/src/admin/routes/shipping-profiles/page.tsx`):**
  - Kargo profilleri listesi, "Mağaza genelinde tüm yeni ürünlerde varsayılan uygula" seçeneği ve "Mevcut ürünlere de uygula" butonu (`adminApiUrl` kullanarak).

## 2. Ücretsiz Kargo Aktifken Ücretli Kargoları Gizleme

- `apps/web/src/lib/medusa/checkout-pricing.ts`: `sortShippingOptions` (veya `filterVisibleShippingOptions`) içinde `Ücretsiz Kargo` (`amount === 0` ve isimde `ücretsiz`/`free`) mevcutsa `amount > 0` olan ücretli kargo seçenekleri filtrelenir; ücretsiz seçenekler (`Ücretsiz Kargo`, `Mağazadan Teslim`) kalır.
- `apps/web/src/tests/shipping-selection.test.ts`: TDD ile önce başarısız test yazılıp sonra geçirilir.
- `apps/medusa/src/admin/lib/api-url.ts` + 3 özel admin sayfası düzeltmesi de bu PR'a dahil edilir.
