# Plan: Kargo Ücretsiz Seçimi ve Fiyat/Vergi Hesaplama Düzeltmesi

## Amaç

- Sepette ücretsiz kargo eşiğini geçen (veya kargo seçeneklerinde 0 TL kargo bulunan) kullanıcılara Ödeme ve Teslimat sayfasında varsayılan olarak "Ücretsiz Kargo" seçeneğinin atanması ve listenin en başında sunulması.
- Sepet sayfasında kargo eşiği aşıldığında sipariş özetinde "Kargo Tutarı: Ücretsiz" yazması.
- Medusa v2 vergi dahil (tax inclusive) sistemine uygun olarak:
  - Ürün satırlarında KDV dahil tutarın gösterilmesi (`item.total || item.unit_price * item.quantity`).
  - "Ara Toplam (KDV Hariç)" satırında KDV'nin iki kez düşülmesinin engellenmesi (`cart.item_subtotal ?? cart.subtotal`).
  - "Ödenecek Tutar / Toplam Tutar" hesabının KDV dahil ürün tutarı + kargo + kapıda ödeme - indirim olarak doğru hesaplanması.

## Adımlar

1. **TDD:** Kargo seçimi ve tutar hesaplamaları için birim testler yaz (`apps/web/src/tests/shipping-selection.test.ts`).
2. **Kargo Seçimi İyileştirmesi:** `apps/web/src/components/checkout-form.tsx`:
   - `getDefaultShippingOption(shippingOptions, existingMethodId)` mantığı kur: Eğer "Ücretsiz Kargo" veya `amount === 0` olan adrese teslimat seçeneği varsa varsayılan olarak onu seç.
   - Kargo seçenekleri listesinde ücretsiz kargo seçeneğini en üste sırala.
3. **Fiyat ve Vergi Düzeltmeleri:**
   - `apps/web/src/components/checkout-form.tsx`: `itemTotal` (KDV dahil ürünler toplamı), `subtotal` (KDV hariç ara toplam) ve `total` hesabını düzelt.
   - `apps/web/src/components/cart-view.tsx`: Satır toplamlarını KDV dahil göster, kargo durumunu "Ücretsiz" yap, özet ara toplamını düzelt.
   - `apps/web/src/app/(store)/siparis-onay/page.tsx`: Ara toplam hesabını düzelt.
4. **Doğrulama:**
   - Testleri çalıştır (`pnpm test`).
   - Canlı HTTP ile ödeme sayfasında 1800 TL'lik sepetin "Ücretsiz" kargo ile açıldığını doğrula.
   - `pnpm verify:quality`, `format`, `lint`, `typecheck`.
   - Commit & push, CI kontrolü.
