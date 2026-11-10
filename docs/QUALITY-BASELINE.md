# Kalite ve Performans Temel Ölçüm Raporu (docs/QUALITY-BASELINE.md)

Bu dosya `scripts/measure-quality.ts` tarafından otomatik olarak üretilmiştir. Sayılar elle yazılmaz.
Tarih: 2026-11-10 12:31:12 (UTC)

### Mobil Profil Lighthouse ve First Load JS Ölçümleri (3 Çalıştırma Medyanı)

| Sayfa        | URL                 | Performance | Accessibility | Best Practices |    SEO    |    LCP    |    CLS    |    TBT    | First Load JS (Gzip) |
| :----------- | :------------------ | :---------: | :-----------: | :------------: | :-------: | :-------: | :-------: | :-------: | :------------------: |
| Anasayfa     | `/`                 |  ölçülmedi  |   ölçülmedi   |   ölçülmedi    | ölçülmedi | ölçülmedi | ölçülmedi | ölçülmedi |       111.9 kB       |
| Tüm Ürünler  | `/urunler`          |  ölçülmedi  |   ölçülmedi   |   ölçülmedi    | ölçülmedi | ölçülmedi | ölçülmedi | ölçülmedi |       105.5 kB       |
| Ürün Detayı  | `/urun/ornek-urun`  |  ölçülmedi  |   ölçülmedi   |   ölçülmedi    | ölçülmedi | ölçülmedi | ölçülmedi | ölçülmedi |       109.3 kB       |
| Sepet        | `/sepet`            |  ölçülmedi  |   ölçülmedi   |   ölçülmedi    | ölçülmedi | ölçülmedi | ölçülmedi | ölçülmedi |       111.1 kB       |
| Blog Listesi | `/blog`             |  ölçülmedi  |   ölçülmedi   |   ölçülmedi    | ölçülmedi | ölçülmedi | ölçülmedi | ölçülmedi |       110.7 kB       |
| Blog Detayı  | `/blog/ornek-yazi`  |  ölçülmedi  |   ölçülmedi   |   ölçülmedi    | ölçülmedi | ölçülmedi | ölçülmedi | ölçülmedi |       110.6 kB       |
| Puck Sayfası | `/sayfa/hakkimizda` |  ölçülmedi  |   ölçülmedi   |   ölçülmedi    | ölçülmedi | ölçülmedi | ölçülmedi | ölçülmedi |      ölçülmedi       |

### Hedefler ve Değerlendirme

- **Accessibility:** Hedef ≥ 95 (WCAG 2.1 AA uyumu).
- **SEO:** Hedef ≥ 95 (Yapılandırılmış veri, meta etiketler, robots/sitemap).
- **CLS:** Hedef < 0.1 (Kayıpsız görsel rezervasyonları ve stabil düzen).
- **First Load JS:** Hedef ~110 kB (Puck editör kodu public paketlere dahil edilmez).
