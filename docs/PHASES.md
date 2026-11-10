# Faz Geçmişi ve Yol Haritası (docs/PHASES.md)

Bu dosya `AGENTS.md` içinden referanslanır ve ihtiyaç olunca okunur. Her faz için sıra: brainstorming → plan → TDD → doğrulama → rapor → PR. Faz geçişini insan onaylar.

## A. Tamamlanan fazlar (referans)

| Faz              | Konu                                                                         | Önemli çıktı / ders                                                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0, 0.1, 0.2, 0.3 | Monorepo iskeleti, CI, güvenlik tabanı, bellek ölçüm betiği, Users yetkileri | Sahte bellek ölçümü ve sahte SHA tespit edilip düzeltildi. `.npmrc` içinde `public-hoist-pattern[]=@medusajs/*` şart. Süper admin yalnızca süper admin tarafından atanır.                                 |
| 1                | Medusa TR mağazası                                                           | TRY, %20/%10/%1 KDV, KDV dahil fiyat, Standart/Ücretsiz(1500 TL)/Mağazadan teslim kargo, idempotent `setup:store`.                                                                                        |
| 2                | Vitrin ve sepet                                                              | Ürün listesi/detay, JSON-LD, httpOnly sepet çerezi, stok korumaları.                                                                                                                                      |
| 3, 3.1           | Misafir checkout, kupon, sipariş onayı                                       | Form doğrulama, TC no saklanmaz, `siparis-onay` çerez korumalı, 409 çakışma koruması.                                                                                                                     |
| 4, 4.1           | PayTR (iFrame/yönlendirme, sandbox) + Kapıda ödeme                           | Şifreli ayarlar, callback kilidi + idempotency, açılış koruması, COD hizmet kalemi, `captured`, manuel iade listesi, indeksli callback araması.                                                           |
| 5, 5.1, 5.2, 5.3 | Payload içerik, Puck sayfa oluşturucu, blog, SEO, menü                       | 14 Puck bileşeni, `props.id` biçimi, derin bağlantı doğrulaması, taslak sızıntı koruması, rezerve slug, sitemap/robots/JSON-LD, hukuk sayfaları şablonu (avukat onaylı metin gerekir). CI env düzeltmesi. |
| 6A               | PostgreSQL arama (`unaccent` + `pg_trgm`)                                    | Türkçe harf katlama, SQL'de filtre/sıralama/sayfalama. 6.2 ile parametre tip dönüşümü ve sessiz yedek sorgu kaldırıldı.                                                                                   |
| 6B               | E-posta bildirimleri (SMTP, admin ayarı)                                     | Şifreli SMTP parolası, idempotent gönderim, maskeli günlük, kişisel veri saklanmaz.                                                                                                                       |
| 6C               | Sipariş yönetimi, kargo takibi                                               | Takip kodu + HTTPS bağlantı doğrulaması, `/siparis-takip` anti-enumeration + hız sınırı, COD tahsil, güvenli iptal, PII'siz CSV.                                                                          |
| 6.1, 6.2         | 6A/6B/6C düzeltmeleri                                                        | Marka sabitleri temizlendi, e-posta tabloları migration'a taşındı, `payload_json` kaldırıldı.                                                                                                             |
| 6.3              | Payload üretim migration'ları                                                | PR #19. `payload migrate`, üretimde `push: false`, CI'da boş DB'de migrate + şema senkron kontrolü. **İnsan doğrulaması ve merge bekliyor.**                                                              |

## B. Kalan fazlar (öneri sırası)

Her faz kendi PR'ı ve kendi `verify-*` betiğiyle gelir. Sıra değişebilir, ama canlıya çıkmadan önce 7 ve 8 tamamlanmış olmalı.

### Faz 7 — Üretim altyapısı (eski adıyla Faz 0B). Yalnızca insan açıkça isterse başla.

- Ubuntu 22.04 sunucuda systemd servisleri, root olmayan servis kullanıcısı, `deploy/` klasörü.
- Ayrı PostgreSQL ve Redis örneği (Redis 6380, web 3100, Medusa 9000), bellek ayarları.
- OpenLiteSpeed/CyberPanel ters vekil ve SSL. Mevcut canlı siteleri ve mail/DNS servislerini bozma.
- Dağıtım sırası: `medusa db:migrate` → `payload migrate` → servisleri başlat. Geri alma planı.
- Gizli bilgiler yalnızca sunucuda ortam dosyasında, depoda yok. Yedekleme (PostgreSQL + medya), geri yükleme testi.
- GitHub Actions deploy iş akışı (etiket/onay tetiklemeli, Environment secrets, SHA'lı action).
- İzleme ve log döngüsü, sağlık uç noktaları, açılış korumalarının üretimde doğrulanması.

### Faz 8 — Ödeme canlıya hazırlık

- Gerçek PayTR sandbox testi (staging + tünel). Kimlik bilgileri yalnızca admin ayar sayfasına girilir.
- Callback URL, iade akışı (manuel) runbook'u, başarısız ödeme ve yeniden deneme senaryoları.
- Sandbox'tan canlıya geçiş kontrol listesi. COD limitleri ve kargo ücretleri gerçek verilerle.

### Faz 9 — Yasal ve mali hazırlık (kod dışı girdiler insandan gelir)

- Mesafeli satış, KVKK aydınlatma, iade/iptal, gizlilik metinleri (avukat onaylı) Payload'a girilir.
- KDV sınıflarının muhasebeci onayı, fatura/e-arşiv entegrasyon ihtiyacı analizi.
- Çerez/izin bildirimi gereksinimi (analitik eklenecekse).

### Faz 10 — WooCommerce geçişi ve katalog araçları

- `docs/MIGRATION-WOOCOMMERCE.md` esas alınarak ürün/kategori/müşteri/sipariş içe aktarma betikleri (CSV), kuru çalıştırma modu, hata raporu.
- Toplu ürün içe/dışa aktarma, varyant görselleri, düşük stok uyarı e-postası.
- 301 yönlendirme listesi eski URL'ler için (Payload `redirects`).

### Faz 11 — Performans, erişilebilirlik, SEO cilası

- Lighthouse ölçümleri (gerçek), `<img>` uyarılarının `next/image` ile giderilmesi, görsel boyutlandırma.
- WCAG kontrolü, klavye gezinmesi, odak yönetimi.
- Önbellek stratejisi ve `revalidateTag` kapsamı, sitemap bölme, yapılandırılmış veri genişletme.

### Faz 12 — Güvenlik sertleştirme

- Admin için 2FA, denetim günlüğü (kim neyi değiştirdi), oturum süreleri.
- Hız sınırlarının Redis'e taşınması (çoklu süreç), CSP nonce'a geçiş (`unsafe-inline`/`unsafe-eval` azaltma).
- Bağımlılık güncelleme akışı (Dependabot PR'ları, major güncelleme planı), bağımsız güvenlik gözden geçirme.

### Faz 13 — İsteğe bağlı büyüme özellikleri (insan öncelik verirse)

- Müşteri hesabı, adres defteri, sipariş geçmişi, favoriler.
- Ürün yorumları (moderasyonlu), bülten (açık rıza ile), kampanya/kupon yönetimi arayüzü.
- Kargo firması API entegrasyonu (etiket, otomatik takip), çoklu dil/para birimi.

## C. Her faz için sabit kapanış listesi

1. Temiz klon + CI ortamıyla tüm kalite adımları (AGENTS.md Bölüm 4).
2. GitHub CI'nın adım adım yeşil olduğunun doğrulanması.
3. Canlı HTTP doğrulama betiği boş veritabanından çalışıyor.
4. Önceki fazların `verify-*` betikleri hâlâ geçiyor (regresyon).
5. Gerçek bellek ve First Load JS ölçümü (`medusa start`, `next start`).
6. `docs/` güncellendi (ROADMAP, ilgili tasarım dokümanı, RUNBOOK).
7. Rapor: yapılamayanların açık listesi dahil.
