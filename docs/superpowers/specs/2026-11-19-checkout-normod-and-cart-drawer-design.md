# Ödeme Ekranı (Normod/Shopify Düzeni) & Yandan Açılan Sepet Tasarımı

## Amaç ve Kapsam

1. **Ödeme Ekranı (`/odeme`):**
   - Mağaza `Navbar` ve `Footer` kalabalığı olmadan, ortada mağaza logosu/adı bulunan sade ödeme üst bandı (`(checkout)` route grubu).
   - İki sütunlu soft bölünmüş düzen: sol form (`#FFFFFF`, `580px` masaüstü genişlik), sağ sipariş özeti (`#F5F5F5`, `480px` masaüstü genişlik, `#DEDEDE`/`#D6D6D6` kenarlıklar, `#3A4A5B` / `#666666` soft aksanlar).
   - Sağdaki sipariş özetinde ürün satırları Shopify/Normod yapısında: `64×64px` (`w-16 h-16`) beyaz zeminli, ince kenarlıklı yuvarlatılmış ürün görseli + sağ üst köşede yuvarlak adet rozeti (`21×21px`), ortada ürün adı + varyant bilgisi, sağda tutar. Görseli olmayan ürünlerde `PlaceholderImage` fallback'i.
2. **Yandan Açılan Sepet (Cart Drawer):**
   - Header'daki "Sepet" butonuna tıklandığında veya ürün detayında "Sepete Ekle" başarılı olduğunda sağdan açılan çekmece (`max-w-[440px]`).
   - Ürün görselleri (`80×80px`), başlık, varyant bilgisi, `- adet +` hap şeklinde miktar seçici, silme butonu, ücretsiz kargo ilerleme çubuğu, toplam tutar ve "Ödemeye Geç" / "Sepete Git" butonları.
   - `/sepet` sayfasındaki `CartView` bileşeninde de gerçek ürün görselleri (`item.thumbnail || item.variant?.product?.thumbnail`) gösterilir.

## Yaklaşım

- `(checkout)` Next.js App Router route grubu: `/odeme` URL'sini koruyarak `StoreLayout`'tan bağımsız sade ödeme üst bandı sağlar; istemci tarafı pathname kontrolü gerektirmez.
- `CartDrawerProvider` `(store)/layout.tsx` içinde `Navbar` ve `main`'i sarar; böylece hem `CartDrawerTrigger` hem `AddToCartForm` aynı sepet durumunu paylaşır ve header rozeti anlık güncellenir.
- Mevcut `addToCartAction`, `updateCartItemAction`, `removeCartItemAction` ve `/api/cart` uç noktaları yeniden kullanılır; yeni backend/veritabanı değişikliği yoktur.

## Kısıtlar

- Marka/alan adı sabit yazılmaz (`getSiteSettings()` kullanılır, yedek `"Mağaza"`).
- URL'ler `safeHref` ile doğrulanır, kullanıcı girdisi HTML'e kaçırılmadan basılmaz.
- Public sayfalarda First Load JS bütçesi (~110 kB) korunur.
