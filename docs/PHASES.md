# Faz Geçmişi ve Yol Haritası (docs/PHASES.md)

Bu dosya `AGENTS.md` içinden referanslanır ve ihtiyaç olunca okunur. Her faz için sıra: brainstorming → plan → TDD → doğrulama → rapor → PR. Faz geçişini insan onaylar.

## A. Tamamlanan fazlar (referans)

| Faz              | Konu                                                                         | Önemli çıktı / ders                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0, 0.1, 0.2, 0.3 | Monorepo iskeleti, CI, güvenlik tabanı, bellek ölçüm betiği, Users yetkileri | Sahte bellek ölçümü ve sahte SHA tespit edilip düzeltildi. `.npmrc` içinde `public-hoist-pattern[]=@medusajs/*` şart. Süper admin yalnızca süper admin tarafından atanır.                                   |
| 1                | Medusa TR mağazası                                                           | TRY, %20/%10/%1 KDV, KDV dahil fiyat, Standart/Ücretsiz(1500 TL)/Mağazadan teslim kargo, idempotent `setup:store`.                                                                                          |
| 2                | Vitrin ve sepet                                                              | Ürün listesi/detay, JSON-LD, httpOnly sepet çerezi, stok korumaları.                                                                                                                                        |
| 3, 3.1           | Misafir checkout, kupon, sipariş onayı                                       | Form doğrulama, TC no saklanmaz, `siparis-onay` çerez korumalı, 409 çakışma koruması.                                                                                                                       |
| 4, 4.1           | PayTR (iFrame/yönlendirme, sandbox) + Kapıda ödeme                           | Şifreli ayarlar, callback kilidi + idempotency, açılış koruması, COD hizmet kalemi, `captured`, manuel iade listesi, indeksli callback araması.                                                             |
| 5, 5.1, 5.2, 5.3 | Payload içerik, Puck sayfa oluşturucu, blog, SEO, menü                       | 14 Puck bileşeni, `props.id` biçimi, derin bağlantı doğrulaması, taslak sızıntı koruması, rezerve slug, sitemap/robots/JSON-LD, hukuk sayfaları şablonu (avukat onaylı metin gerekir). CI env düzeltmesi.   |
| 6A               | PostgreSQL arama (`unaccent` + `pg_trgm`)                                    | Türkçe harf katlama, SQL'de filtre/sıralama/sayfalama. 6.2 ile parametre tip dönüşümü ve sessiz yedek sorgu kaldırıldı.                                                                                     |
| 6B               | E-posta bildirimleri (SMTP, admin ayarı)                                     | Şifreli SMTP parolası, idempotent gönderim, maskeli günlük, kişisel veri saklanmaz.                                                                                                                         |
| 6C               | Sipariş yönetimi, kargo takibi                                               | Takip kodu + HTTPS bağlantı doğrulaması, `/siparis-takip` anti-enumeration + hız sınırı, COD tahsil, güvenli iptal, PII'siz CSV.                                                                            |
| 6.1, 6.2         | 6A/6B/6C düzeltmeleri                                                        | Marka sabitleri temizlendi, e-posta tabloları migration'a taşındı, `payload_json` kaldırıldı.                                                                                                               |
| 6.3              | Payload üretim migration'ları                                                | PR #19. `payload migrate`, üretimde `push: false`, CI'da boş DB'de migrate + şema senkron kontrolü. Merge edildi.                                                                                           |
| 11.0             | Taşınan düzeltmeler                                                          | PR #20. `sharp` pinli, gerçek görsel boyutları (400/800/1600), `next/image`, `verify-content` Adım 2 düzeltmesi.                                                                                            |
| 11, 11.1         | Performans, Erişilebilirlik (WCAG 2.1 AA), SEO, Kalite Güvencesi             | PR #21. Dinamik handle/slug ve gerçek Lighthouse ölçümü, Axe-core canlı sayfa taraması, canlı klavye gezintisi, XML Sitemap Index, yerel fontlar, zaman sabitli revalidateTag, Postgres trigram indeksleri. |
| 11.5             | CI'da canlı doğrulama                                                        | PR #23. `live-verify` CI işi, `pnpm verify:all` koşucusu, sahte test/`continue-on-error`/ölçülmedi koruma kuralları, `verify-logs` artifact.                                                                |

## B. Kalan fazlar (öneri sırası)

Her faz kendi PR'ı ve kendi `verify-*` betiğiyle gelir. **Güncel yürütme sırası: 12 → 10 → 7 → 8 → 9 → 13 → 14.** Numaralar eski raporlarla karışmasın diye korundu, sıra bu satırdır. Canlıya çıkmadan önce 7, 8 ve 9 tamamlanmış olmalı. Faz 10 (WooCommerce geçişi) Faz 12'ye bağlıdır (hesap ve şifre taşıma).

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
- Müşteri şifreleri: WP hash'i şifreli alanda saklanır, ilk girişte doğrulanıp Medusa biçimine çevrilir (tembel taşıma). Hash'ler repoya, loga, teste girmez, testlerde sahte hash kullanılır. Gerçek örnek hash biçimi insandan (yalnızca ilk karakterler) teyit edilir. Hiç girmeyenler için şifremi unuttum akışı yedektir.
- Eski siparişler geçmiş kayıt olarak içe aktarılır (ödeme/kargo/stok/e-posta tetiklenmez), tutar ve KDV birebir korunur.
- Toplu ürün içe/dışa aktarma, varyant görselleri, düşük stok uyarı e-postası.
- 301 yönlendirme listesi eski URL'ler için (Payload `redirects`).

### Faz 12 — Müşteri hesabı (Faz 11'den sonra, Faz 10'dan önce)

- Kayıt, giriş, çıkış, e-posta ile şifre sıfırlama (süreli, tek kullanımlık bağlantı), profil, adres defteri, sipariş geçmişi. Medusa customer auth kullanılır.
- Misafir siparişler, e-posta doğrulandıktan sonra hesaba bağlanır. Başkasının siparişi görülemez (yetki testi).
- Güvenlik: giriş ve şifre sıfırlama hız sınırı, kullanıcı numaralandırma koruması (tek tip yanıt ve süre), httpOnly + SameSite oturum çerezi, parola kuralları.
- KVKK: açık rıza kaydı, hesap silme/anonimleştirme, PII loga yazılmaz. Misafir checkout çalışmaya devam eder.
- Şifre doğrulama, birden çok hash biçimini destekleyen **doğrulayıcı listesi** olarak tasarlanır. Şimdilik yalnızca Medusa biçimi vardır. Hesap kaydında "eski hash" için şifreli, API'de asla dönmeyen bir alan hazır tutulur. WooCommerce hash doğrulayıcıları (phpass `$P$` ve WP 6.8+ `$wp$2y$`) Faz 10'da eklenir. Giriş başarılıysa şifre Medusa biçimine yeniden hash'lenir ve eski hash silinir.
- Kendi `verify-accounts` betiği: canlı HTTP ile kayıt, giriş, yanlış şifre, hız sınırı, yetkisiz sipariş erişimi, şifre sıfırlama, silme.

### Faz 13 — Güvenlik sertleştirme

- Admin için 2FA, denetim günlüğü (kim neyi değiştirdi), oturum süreleri.
- Hız sınırlarının Redis'e taşınması (çoklu süreç), CSP nonce'a geçiş (`unsafe-inline`/`unsafe-eval` azaltma).
- Bağımlılık güncelleme akışı (Dependabot PR'ları, major güncelleme planı), bağımsız güvenlik gözden geçirme.

### Faz 14 — İsteğe bağlı büyüme özellikleri (insan öncelik verirse)

- Favoriler.
- Ürün yorumları (moderasyonlu), bülten (açık rıza ile), kampanya/kupon yönetimi arayüzü.
- Kargo firması API entegrasyonu (etiket, otomatik takip), çoklu dil/para birimi.

## C. Her faz için sabit kapanış listesi

1. Temiz klon + CI ortamıyla tüm kalite adımları (`AGENTS.md` Bölüm 4).
2. GitHub CI'da hem `security-and-quality` hem `live-verify` işlerinin adım adım yeşil olduğunun ve `verify-logs` artifact'ının yüklendiğinin doğrulanması.
3. `pnpm verify:all` (tüm canlı HTTP doğrulama betikleri) ve `REQUIRE_LIVE_SERVER=true` canlı tarayıcı testleri boş veritabanından sıfır skipped ile çalışıyor (`verify-logs/SUMMARY.md`).
4. Önceki fazların `verify-*` betikleri `verify:all` içinde hâlâ geçiyor (regresyon).
5. Gerçek bellek ve First Load JS ölçümü (`medusa start`, `next start`).
6. `docs/` güncellendi (PHASES, ilgili tasarım dokümanı, RUNBOOK).
7. Rapor: `.github/pull_request_template.md` kontrol listesi ve yapılamayanların açık listesi dahil.
