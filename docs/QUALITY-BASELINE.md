# Kalite ve Performans Temel Ölçüm Raporu (docs/QUALITY-BASELINE.md)

Bu dosya `scripts/measure-quality.ts` tarafından otomatik olarak üretilmiştir. Sayılar elle yazılmaz.
Tarih: 2026-11-10 13:50:38 (UTC)

### Mobil Profil Lighthouse ve First Load JS Ölçümleri (3 Çalıştırma Medyanı)

| Sayfa        | URL                                      | Performance | Accessibility | Best Practices | SEO |   LCP   |  CLS  |  TBT  | First Load JS (Gzip) |
| :----------- | :--------------------------------------- | :---------: | :-----------: | :------------: | :-: | :-----: | :---: | :---: | :------------------: |
| Anasayfa     | `/`                                      |     98      |      96       |      100       | 100 | 2408 ms | 0.001 | 29 ms |       111.9 kB       |
| Tüm Ürünler  | `/urunler`                               |     98      |      95       |      100       | 100 | 2408 ms | 0.002 | 14 ms |       105.5 kB       |
| Ürün Detayı  | `/urun/test-urun-sabit-1`                |     98      |      95       |      100       | 100 | 2259 ms | 0.014 | 31 ms |       109.4 kB       |
| Sepet        | `/sepet`                                 |     98      |      96       |      100       | 63  | 2257 ms | 0.004 | 13 ms |       111.1 kB       |
| Blog Listesi | `/blog`                                  |     98      |      96       |      100       | 100 | 2257 ms | 0.030 | 14 ms |       110.6 kB       |
| Blog Detayı  | `/blog/yeni-sezon-hikayesi-ege-esintisi` |     98      |      95       |      100       | 100 | 2258 ms | 0.005 | 13 ms |       110.6 kB       |
| Puck Sayfası | `/sayfa/hakkimizda`                      |     98      |      96       |      100       | 100 | 2257 ms | 0.002 | 13 ms |      ölçülmedi       |

### Hedefler ve Değerlendirme

- **Accessibility:** Hedef ≥ 95 (WCAG 2.1 AA uyumu).
- **SEO:** Hedef ≥ 95 (Yapılandırılmış veri, meta etiketler, robots/sitemap).
- **CLS:** Hedef < 0.1 (Kayıpsız görsel rezervasyonları ve stabil düzen).
- **First Load JS:** Hedef ~110 kB (Puck editör kodu public paketlere dahil edilmez).

### Gerçek Bellek Ölçümü (Yük Altında RSS / Working Set)

| Servis               | Port | Ölçülen RSS |  Bütçe  |    Durum     |
| :------------------- | :--: | :---------: | :-----: | :----------: |
| Medusa v2            | 9000 |  263.3 MB   | 512 MB  | ✅ Bütçe İçi |
| Next.js Web          | 3100 |  289.4 MB   | 384 MB  | ✅ Bütçe İçi |
| Toplam Node Heap/RSS |  -   |  552.7 MB   | ~896 MB | ✅ Bütçe İçi |
