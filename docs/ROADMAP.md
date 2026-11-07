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

### 📋 Faz 1: Medusa v2 Temel Ticaret Motoru

- [ ] Türkiye e-ticaret kuralları: Türk Lirası (TRY), %20 standart KDV vergi oranı
- [ ] Ürün ve varyant modeli (Beden, Renk, Materyal vb.)
- [ ] Stok takibi ve envanter yönetimi
- [ ] Medusa Admin paneli (`/app`) üzerinde ürün yönetim doğrulaması

---

### 📋 Faz 2: Payload CMS 3 ve Puck Görsel Sayfa Düzenleyici

- [ ] Puck görsel blok bileşenleri (Hero, Ürün Izgarası, Metin & Görsel, Banner, SSS)
- [ ] JSON veri modelinin Payload CMS'e entegrasyonu
- [ ] Ürün sayfalarını `medusaProductId` ile zenginleştirme altyapısı
- [ ] Blog ve kurumsal sayfalar koleksiyonları

---

### 📋 Faz 3: Storefront Arayüzü ve Kullanıcı Deneyimi

- [ ] Medusa resmi starter storefront temelinde modern, responsive arayüz
- [ ] Ürün listeleme, filtreleme (kategori, fiyat, varyant) ve anlık arama
- [ ] Ürün detay sayfası (galeri, varyant seçimi, stok durumu, KDV dahil fiyat)
- [ ] Boş durum (empty state) ve yüklenme (skeleton) bileşenleri

---

### 📋 Faz 4: Müşteri Hesabı ve Kimlik Doğrulama

- [ ] Müşteri kayıt ve giriş akışları (Rate-limit korumalı)
- [ ] Şifremi unuttum / Şifre sıfırlama e-posta akışı
- [ ] Profil düzenleme ve teslimat/fatura adres defteri
- [ ] Müşteri sipariş geçmişi ve durum sorgulama ekranı

---

### 📋 Faz 5: Sepet, Kupon ve Kargo Motoru

- [ ] Dinamik sepet çekmecesi ve sepet sayfası
- [ ] İndirim kuponu ve promosyon kodu motoru (brute-force korumalı)
- [ ] Kargo ücreti hesaplama (belirli sepet tutarı üzeri ücretsiz kargo desteği)
- [ ] Adres adımları ve form doğrulamaları (TC Kimlik / Vergi No opsiyonel desteği)

---

### 📋 Faz 6: Ödeme Sağlayıcıları (PayTR & Kapıda Ödeme)

- [ ] PayTR iFrame ve 3D Secure ödeme sağlayıcısı eklentisi
- [ ] PayTR sunucu bildirim (callback/webhook) işleyicisi (HMAC, timingSafeEqual, tutar kontrolü, idempotency)
- [ ] Kapıda Ödeme (Nakit / Kredi Kartı) sağlayıcısı ve ek hizmet bedeli mantığı
- [ ] Başarılı ve başarısız ödeme yönlendirme sayfaları

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
5. Zorunlu 7 maddelik faz sonu raporu hazırlanmıştır.
