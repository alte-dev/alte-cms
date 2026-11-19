# Ödeme Ekranı & Yandan Açılan Sepet Uygulama Planı

## Görev 1: TDD — Başarısız Birim Testleri Yaz

- Dosya: `apps/web/src/tests/checkout-drawer-ux.test.ts`
- Testler:
  1. `CheckoutOrderSummaryItem` (veya `CheckoutForm` sipariş özeti): `64×64px` (`w-16 h-16`) ürün görseli + adet rozeti + varyant başlığı render eder; görsel yoksa fallback gösterir; COD hizmet kalemini ürün satırı olarak göstermez.
  2. `CartDrawer`: açıkken ürün görselleri, `- / +` miktar artırma/azaltma butonları, toplam tutar, "Ödemeye Geç" (`/odeme`) ve "Sepete Git" (`/sepet`) linklerini render eder; miktar artırma/azaltma `updateCartItemAction` / `removeCartItemAction` çağırır.
  3. `CartView`: `item.thumbnail` varsa `<img>` render eder, yoksa `PlaceholderImage` kullanır.
- Doğrulama: `pnpm --filter web test -- src/tests/checkout-drawer-ux.test.ts` (başlangıçta fail beklenir).

## Görev 2: Minimal Ödeme Layout ve Normod/Shopify Sipariş Özeti

- `apps/web/src/app/(checkout)/layout.tsx`: `getSiteSettings()` ile ortada mağaza logosu/adı, sol/sağ sade geri dönüş linki (`/` veya `/sepet`), `Navbar`/`Footer` yok.
- `apps/web/src/app/(store)/odeme/page.tsx` -> `apps/web/src/app/(checkout)/odeme/page.tsx`: URL `/odeme` olarak korunur, tam genişlik `#FFFFFF` / `#F5F5F5` bölünmüş düzen (`580px` / `480px`).
- `apps/web/src/components/checkout-form.tsx`: Sipariş özeti yan panelinde `64×64px` ürün görselleri + adet rozeti, soft `#F5F5F5` arka plan, `#DEDEDE`/`#D6D6D6` kenarlıklar ve `#3A4A5B` soft aksanlar.

## Görev 3: Yandan Açılan Sepet (Cart Drawer) + Görseller

- `apps/web/src/components/cart-drawer-provider.tsx`: `CartDrawerProvider`, `useCartDrawer()`, `CartDrawer` (sağdan açılan panel, Escape/backdrop ile kapanma, `- qty +` hap seçici, silme, ücretsiz kargo çubuğu, toplam ve CTA'lar).
- `apps/web/src/components/cart-drawer-trigger.tsx`: `Navbar` içindeki masaüstü ve mobil Sepet butonları.
- `apps/web/src/components/navbar.tsx`, `apps/web/src/app/(store)/layout.tsx`, `apps/web/src/components/add-to-cart-button.tsx`: Entegrasyon.
- `apps/web/src/components/cart-view.tsx`: Gerçek ürün görsellerini (`item.thumbnail || item.variant?.product?.thumbnail`) render etme.

## Görev 4: Doğrulama & PR

- `pnpm format:check`, `pnpm lint`, `pnpm check:baseline`, `pnpm check:verify-scripts`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit --prod --audit-level=high`, `gitleaks`.
- Commit & push, PR açma ve GitHub Actions CI (`security-and-quality`, `live-verify`) kontrolü.
