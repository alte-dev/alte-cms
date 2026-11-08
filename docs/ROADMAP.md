# Proje Yol Haritası (ROADMAP.md)

Bu doküman, aşamalı e-ticaret platformunun geliştirme fazlarını, teslimat kontrol listelerini ve her faz için "bitti" (Definition of Done) kriterlerini tanımlar.

---

## Faz Kontrol Listesi

### ✅ Faz 0: Yerel Altyapı, Mimari, Güvenlik Tabanı ve Bellek Ölçümü (ŞU ANKİ FAZ)

- [x] Public depo hijyeni (.gitignore, .gitattributes, SECURITY.md, dependabot, gitleaks)
- [x] Monorepo mimarisi (pnpm workspaces: apps/medusa, apps/web, packages/shared)
- [x] Düşük kaynak ayarlı Docker Compose (Postgres 64MB shared_buffers, Redis 64MB maxmemory)
- [x] Medusa v2 ve Payload 3 iskeleti (ortam şema doğrulaması ile fail-closed)
- [x] İki yönlü Medusa erişimi (127.0.0.1:9000 server-side, api.localhost:9000 client-side) ve `test:smoke`
- [x] Üretim bellek ölçüm altyapısı (`measure-memory.ts`, `seed-fake-catalog.ts`, `MEMORY-BASELINE.md`)
- [x] Güvenli CI iş akışı (pull_request, pinned SHA, Gitleaks, typecheck, lint, audit)
- [x] 8 adet kapsamlı mimari ve güvenlik dokümanı

---

### ⏳ Faz 0B: Sunucu Dağıtım Altyapısı (ERTELENDİ / KAPALI)

> _Bu faz kullanıcı tarafından açıkça onay verilene kadar kapalıdır. Depoda deploy/ klasörü açılmaz._

- [ ] Ubuntu 22.04 üzerinde systemd servis dosyaları (root olmayan servis kullanıcıları)
- [ ] PostgreSQL 16 ve Redis 7 yerel kurulum ve bellek optimizasyonu
- [ ] OpenLiteSpeed (CyberPanel) ters vekil (reverse proxy) ve SSL yapılandırması
- [ ] GitHub Actions deploy iş akışı (etiket/onay tetiklemeli, Environment secrets)
- [ ] Otomatik PostgreSQL ve medya yedekleme script'leri

---

### ✅ Faz 1: Medusa v2 Türkiye Mağazası ve Temel Ticaret Motoru (TAMAMLANDI)

- [x] Türkiye e-ticaret kuralları: Türk Lirası (TRY), tek para birimi, %20 Standart KDV, %10 Gıda KDV, %1 Özel İndirimli KDV
- [x] KDV Dahil fiyatlandırma (`is_tax_inclusive = true`, Price Preference) ve sepette ayrı KDV satırı
- [x] İdempotent mağaza kurulumu (`setup-store.ts`, tek komut: `pnpm setup:store`)
- [x] Stok konumu ("Ana Depo") ve servis bölgesi ("Türkiye")
- [x] 3 Kargo seçeneği: Standart Kargo (89.90 TL), Ücretsiz Kargo (1500 TL üzeri kuralı), Mağazadan Teslim (0 TL)
- [x] Hiyerarşik kategoriler (Giyim -> Üst Giyim / Alt Giyim, Aksesuar, Ev & Yaşam) ve temiz ASCII slug normalizasyonu
- [x] Koleksiyonlar (Yeni Gelenler, İndirimdekiler) ve etiketler (organik, yeni-sezon, one-cikan)
- [x] Publishable API Key oluşturma ve satış kanalına bağlama
- [x] Envanter yönetimi, varyant stok bağlama ve stoksuz ürün sepete ekleme reddi (HTTP 400 insufficient_inventory)
- [x] İndirimli fiyat listesi (Sale Price List) ile `calculated_price < original_price` doğrulaması
- [x] Otomatik mağaza doğrulama paketi (`scripts/verify-store.ts`, `pnpm verify:store`)
- [x] Kapsamlı mimari dokümanları (`docs/CATALOG-MODEL.md`, `docs/TAX.md`) ve unit testler

---

### ✅ Faz 2: Vitrin (Storefront) ve Sepet Deneyimi (TAMAMLANDI)

- [x] Next.js 15 App Router vitrin mimarisi (Anasayfa, /urunler, /urun/[handle], /kategori/[slug], /sepet)
- [x] SSR ürün listeleme, filtreleme, sıralama ve sayfalama
- [x] Dinamik ücretsiz kargo barajı göstergesi (Medusa kargo kurallarından dinamik okuma)
- [x] Sepet çekmecesi ve sepet sayfası (ekleme, adet güncelleme, silme, KDV dahil ara toplam/toplam)
- [x] Stok koruması: Yetersiz stokta (N+1) HTTP 400 ve dostça Türkçe hata bildirimi
- [x] JSON-LD Product ve Breadcrumb şemaları
- [x] Otomatik vitrin doğrulama paketi (`scripts/verify-storefront.ts`, `pnpm verify:storefront`)

---

### ✅ Faz 3: Misafir Checkout, Kupon ve Sipariş Onayı (TAMAMLANDI)

- [x] Yasal placeholder sayfaları (`/sayfa/mesafeli-satis-sozlesmesi`, `/sayfa/kvkk`)
- [x] Medusa v2 promosyon ve kupon entegrasyonu (`POST/DELETE /store/carts/:id/promotions`, `TEST10`, `TEST50TL`)
- [x] Geçersiz kuponda kullanıcı dostu Türkçe hata: _"Geçersiz veya süresi dolmuş kupon kodu."_
- [x] Misafir checkout formu (`/odeme`):
  - İletişim bilgileri ve Türkiye cep telefonu E.164 normalizasyonu (`+905...`)
  - Teslimat adresi (Ad, Soyad, 81 il dropdown, İlçe, Açık adres, Posta kodu)
  - Fatura bilgileri (Bireysel / Kurumsal geçişi; Kurumsal için 10 haneli Vergi No; **TC Kimlik No kesinlikle toplanmaz**)
  - Kargo yöntemi seçimi (`/store/shipping-options`)
  - Mesafeli Satış Sözleşmesi ve KVKK yasal onay checkbox'ları (audit zaman damgalı)
  - Çift sipariş koruması (submit butonu loading durumunda devre dışı)
- [x] Sipariş tamamlama ve güvenlik kapısı:
  - Fail-closed: `NODE_ENV=production` veya `ALLOW_DEV_PAYMENT !== 'true'` olduğunda ödeme çağrısı durdurulur.
  - Sadece development + `ALLOW_DEV_PAYMENT=true` olduğunda sipariş tamamlanır.
- [x] Sipariş onayı (`/siparis-onay`):
  - Sipariş sonrası kısa ömürlü (1 saat) `_order_confirmation` httpOnly cookie'si yazılır, `cart_id` silinir.
  - Cookie yoksa `/` ana sayfaya yönlendirilir; varsa Medusa'dan siparişi çekip TL formatında özetler.
- [x] Vitest birim testleri (18 test, telefon normalizasyonu, vergi no, 81 il, checkout schema, payment gate)
- [x] Uçtan uca E2E test script'i (`scripts/verify-checkout.ts`, `pnpm verify:checkout`)

---

### ✅ Faz 4: Ödeme Sağlayıcıları (PayTR & Kapıda Ödeme)

- [x] PayTR iFrame ve 3D Secure ödeme sağlayıcısı modülü (`pp_paytr_paytr`)
- [x] PayTR sunucu bildirim (callback/webhook) işleyicisi (HMAC, timingSafeEqual, tutar kontrolü, idempotency, strictly plain-text `"OK"`)
- [x] Kapıda Ödeme (Nakit / Kredi Kartı) sağlayıcısı (`pp_cod_cod`), dinamik hizmet bedeli ve tavan sepet tutarı kontrolü
- [x] AES-256-GCM ile veritabanında şifreli ödeme ayarları (`PaymentSetting` DML modeli ve servisi)
- [x] Medusa Admin Ödeme Ayarları UI (`/app/payment-settings`), write-only maskeleme ve 1 TL'lik bağlantı testi
- [x] Vitrin ödeme yöntemi seçimi, PayTR iFrame entegrasyonu (`iframeResizer`), CSP kuralları, `/odeme/sonuc` polling ve hata yönetimi
- [x] 13 adımlı E2E ödeme test paketi (`scripts/verify-payments.ts`, `pnpm verify:payments`)
- [x] Kapsamlı ödeme mimari dokümantasyonu ([docs/PAYMENTS.md](PAYMENTS.md)) ve operasyonel kılavuz ([docs/RUNBOOK-PAYMENTS.md](RUNBOOK-PAYMENTS.md))

---

### ✅ Faz 5: İçerik Yönetimi, Görsel Sayfa Oluşturucu (Puck), Blog, SEO ve Menü (TAMAMLANDI)

- [x] Payload CMS 3 koleksiyonları: `Pages` (taslaklar, isHome tekil kontrolü, puckData, SEO), `Posts` (Lexical zengin metin, readingTime otomatik hesaplama, yazar e-posta gizleme), `PostCategories`, `Redirects` (döngüsel yönlendirme koruması).
- [x] Payload CMS 3 globalleri: `SiteSettings` (mağaza bilgileri, iletişim, logo/favicon), `Navigation` (header/footer menüleri, https/iç bağlantı doğrulaması).
- [x] Rol izinleri matrisi & unit test kanıtı: `super-admin`/`admin` tam yetki; `editor` oluşturma/düzenleme izinli, silme ve global ayar düzenleme KESİNLİKLE YASAK; `anonymous` yalnızca published okuyabilir, taslak sızıntısı ve yazar e-posta sızıntısı SIFIR.
- [x] Medya güvenliği: JPEG, PNG, WebP, AVIF destekli, SVG KESİNLİKLE YASAK, 5 MB sınır, alt zorunlu, sharp 400/800/1600 boyutlandırma, güvenli dosya adı sanitization.
- [x] Görsel Sayfa Oluşturucu (`@puckeditor/core@0.23.0`):
  - 14 duyarlı Tailwind bileşeni (Hero, RichText, ImageBlock, Columns, Spacer, Divider, Accordion, Banner, ContactInfo, ProductGrid, FeaturedProducts, CategoryList, FreeShippingBar, LatestPosts).
  - Güvenlik: Zod doğrulaması (max 512 KB, max 200 bileşen, max 6 derinlik, bileşen whitelist'i), safeHref kontrolü, sıfır dangerouslySetInnerHTML.
  - Özel editör rotası `/admin/puck/[id]` (dinamik import ile vitrin bundle'ından izole; vitrine 0 bayt editör kodu sızar).
  - Canlı önizleme rotası `/onizleme/[id]` (staff/token kontrollü, noindex).
  - Pages panelinde "Görsel Düzenleyiciyle Aç" UI butonu.
- [x] Vitrin rotaları:
  - `/` (published isHome sayfası varsa Puck render, yoksa mevcut vitrine fallback).
  - `/sayfa/[slug]` (Puck RSC render, taslaklar 404 döner, yönlendirme kontrolü).
  - `/blog`, `/blog/[slug]`, `/blog/kategori/[slug]` (12/sayfa sayfalama, arama, Lexical render, okuma süresi, yazar adı, sıfır e-posta sızıntısı).
  - Header & Footer: `Navigation` ve `SiteSettings`'ten dinamik besleme + erişilebilir mobil menü çekmecesi (drawer).
- [x] SEO & Yönlendirmeler:
  - `app/sitemap.ts` (Next.js 15 generateSitemaps sayfalama altyapısı; draft/noindex hariç, ürünler, kategoriler, sayfalar, blog).
  - `app/robots.ts` (disallow: /admin, /api, /sepet, /odeme, /onizleme; sitemap bağlantısı).
  - JSON-LD şemaları: WebPage, BlogPosting, Organization, WebSite (script içi `<` karakteri `\u003c` ile escape edilmiştir).
  - Sayfa bazlı generateMetadata (title, description, canonicalUrl, noIndex, openGraph).
- [x] İdempotent içerik seed script'i (`pnpm seed:content`): çift çalıştırmada kopya oluşturmaz, hukuki sayfalar (`mesafeli-satis-sozlesmesi`, `kvkk`) taslak modunda ve yer tutucu uyarısıyla eklenir.
- [x] Kapsamlı doğrulama script'i (`scripts/verify-content.ts`, `pnpm verify:content`).
- [x] Dokümantasyon: `docs/PAGE-BUILDER.md`, `docs/CONTENT-MODEL.md`, `docs/ADMIN-GUIDE.md`, `docs/PERMISSIONS.md`, güncel `docs/ROADMAP.md`.

---

### 📋 Faz 7: Sipariş Yönetimi ve Bildirimler

- [ ] Sipariş durum yaşam döngüsü (Beklemede -> Hazırlanıyor -> Kargolandı -> Tamamlandı)
- [ ] İşlemsel e-postalar (Sipariş onayı, kargo takip bildirimi)
- [ ] Kargo gönderi takip numarası girişi ve kargo firması entegrasyonu
- [ ] Fatura ve sipariş dökümü (PDF çıktısı desteği)

---

### 📋 Faz 8: Performans, Güvenlik Sertleştirmesi ve SEO

- [ ] Gerçekçi katalog ve sepet ile ikinci bellek ölçümü (1.1 GB bütçe kontrolü)
- [ ] Next.js standalone build optimizasyonu
- [ ] Sayfa açılış hızları (Core Web Vitals) ve Lighthouse denetimi
- [ ] Dinamik sitemap.xml, robots.txt ve Schema.org JSON-LD ürün meta verileri

---

### 📋 Faz 9: WooCommerce Geçişi ve Canlıya Çıkış

- [ ] Canlı WooCommerce mağazasından son ürün, müşteri ve sipariş geçmişi aktarımı
- [ ] 301 yönlendirme haritasının doğrulanması
- [ ] DNS TTL düşürme ve alan adı geçişi (www.cisemelifboz.com)
- [ ] Canlı ödeme doğrulaması ve geri dönüş (rollback) tatbikatı

---

## "Bitti" (Definition of Done) Kriterleri

Bir faz ancak şu koşullar sağlandığında tamamlanmış sayılır:

1. İlgili fazın tüm arayüz, backend, veri modeli ve hata yönetimi eksiksiz kodlanmıştır.
2. Sahte buton, prototip veya simüle edilmiş kod bırakılmamıştır.
3. Otomatik birim/entegrasyon testleri yazılmış ve CI üzerinde yeşil geçmiştir.
4. Gitleaks taraması tüm commit geçmişinde temiz çıkmıştır.
5. main dalına doğrudan push yapılmamış, tüm değişiklikler görev dalı üzerinden PR açılarak ve CI doğrulamasıyla merge edilmiştir ([CONTRIBUTING.md](CONTRIBUTING.md)).
6. Yerel admin parolaları sadece geliştirme içindir; staging/production'da güçlü, benzersiz parola kullanılır.
7. Zorunlu faz sonu raporu hazırlanmıştır.
