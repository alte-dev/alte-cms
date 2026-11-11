# Kalite ve Performans Temel Ölçüm Raporu (docs/QUALITY-BASELINE.md)

Bu dosya `scripts/measure-quality.ts` tarafından otomatik olarak üretilmiştir. Sayılar elle yazılmaz.
Tarih: 2026-11-10 23:36:49 (UTC)

### Mobil Profil Lighthouse ve First Load JS Ölçümleri (3 Çalıştırma Medyanı)

| Sayfa        | URL                                      | Performance | Accessibility | Best Practices | SEO |   LCP   |  CLS  |  TBT  | First Load JS (Gzip) |
| :----------- | :--------------------------------------- | :---------: | :-----------: | :------------: | :-: | :-----: | :---: | :---: | :------------------: |
| Anasayfa     | `/`                                      |     97      |      100      |      100       | 100 | 2410 ms | 0.001 | 34 ms |       111.9 kB       |
| Tüm Ürünler  | `/urunler`                               |     96      |      98       |      100       | 100 | 2559 ms | 0.017 | 35 ms |       109.6 kB       |
| Ürün Detayı  | `/urun/test-urun-sabit-1`                |     98      |      98       |      100       | 100 | 2259 ms | 0.014 | 36 ms |       109.4 kB       |
| Sepet        | `/sepet`                                 |     98      |      100      |      100       | 63  | 2258 ms | 0.004 | 38 ms |       111.7 kB       |
| Blog Listesi | `/blog`                                  |     98      |      100      |      100       | 100 | 2259 ms | 0.030 | 38 ms |       110.6 kB       |
| Blog Detayı  | `/blog/yeni-sezon-hikayesi-ege-esintisi` |     98      |      98       |      100       | 100 | 2259 ms | 0.005 | 33 ms |       110.6 kB       |
| Puck Sayfası | `/sayfa/hakkimizda`                      |     97      |      95       |      100       | 100 | 2259 ms | 0.065 | 37 ms |       110.6 kB       |

### Hedefler ve Değerlendirme

- **Accessibility:** Hedef ≥ 95 (WCAG 2.1 AA uyumu).
- **SEO:** Hedef ≥ 95 (Yapılandırılmış veri, meta etiketler, robots/sitemap).
- **CLS:** Hedef < 0.1 (Kayıpsız görsel rezervasyonları ve stabil düzen).
- **First Load JS:** Hedef ~110 kB (Puck editör kodu public paketlere dahil edilmez).

### Gerçek Bellek Ölçümü (Yük Altında RSS / Working Set)

| Servis               | Port | Ölçülen RSS |  Bütçe  |    Durum     |
| :------------------- | :--: | :---------: | :-----: | :----------: |
| Medusa v2            | 9000 |  263.8 MB   | 512 MB  | ✅ Bütçe İçi |
| Next.js Web          | 3100 |  256.9 MB   | 384 MB  | ✅ Bütçe İçi |
| Toplam Node Heap/RSS |  -   |  520.7 MB   | ~896 MB | ✅ Bütçe İçi |
