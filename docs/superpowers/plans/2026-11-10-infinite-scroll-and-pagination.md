# Uygulama Planı: Akıllı Sayfalama & Yönetilebilir Sonsuz Kaydırma (Infinite Scroll)

## Hedef

1. Sayfalama çubuğundaki yüzlerce butonun yan yana basılmasını engelleyen akıllı pencerelemeli (sliding window with ellipsis) responsive `Pagination` bileşeni geliştirmek.
2. Mobildeki devasa yatay taşmayı (`scrollWidth > clientWidth`) ve sayfa küçülmesini (zoom-out) tamamen ortadan kaldırmak.
3. Payload CMS `site-settings` küreseline mağaza yöneticisi ve adminin panelden değiştirebileceği `catalogListingMode` ("pagination" | "infinite") ayarı eklemek ve migration üretmek.
4. Vitrinde `catalogListingMode === "infinite"` seçildiğinde pürüzsüz `IntersectionObserver` destekli sonsuz kaydırma deneyimi sunmak.

---

## Adımlar

### 1. Akıllı Sayfalama Mantığı (TDD)

- **Dosyalar:**
  - `apps/web/src/tests/pagination.test.ts` (Test)
  - `apps/web/src/lib/pagination.ts` (Yardımcı Fonksiyon)
  - `apps/web/src/components/pagination.tsx` (Bileşen)
- **Doğrulama:** `pnpm --filter @alte/web test src/tests/pagination.test.ts`

### 2. Payload `SiteSettings` & Veritabanı Migration

- **Dosyalar:**
  - `apps/web/src/globals/SiteSettings.ts` (`catalogListingMode` alanı)
  - `apps/web/src/migrations/` (Yeni migration dosyası)
- **Doğrulama:** `pnpm --filter @alte/web migrate` ve `pnpm --filter @alte/web typecheck`

### 3. Sonsuz Kaydırma (Infinite Scroll) Bileşeni

- **Dosyalar:**
  - `apps/web/src/app/(store)/actions.ts` (`fetchMoreProductsAction`)
  - `apps/web/src/components/infinite-product-grid.tsx`
- **Doğrulama:** Ürünlerin dinamik yüklenmesi ve aria-live erişilebilirlik testleri.

### 4. Sayfaların Entegrasyonu ve Mobil Düzen Koruması

- **Dosyalar:**
  - `apps/web/src/app/(store)/urunler/page.tsx`
  - `apps/web/src/app/(store)/kategori/[slug]/page.tsx`
  - `apps/web/src/app/(store)/blog/page.tsx`
  - `apps/web/src/app/(store)/blog/kategori/[slug]/page.tsx`
- **Doğrulama:** Mobil viewport'ta `scrollWidth === clientWidth` (0 taşma).

### 5. Regresyon ve CI Kalite Kapıları

- **Komutlar:**
  - `pnpm format:check`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm verify:quality`
  - `pnpm verify:storefront`
