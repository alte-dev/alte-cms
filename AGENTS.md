<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# alte-cms — Ajan Çalışma Kuralları

Bu dosya HER oturumda yüklenir. Kısa tut. Uzun ayrıntı için `docs/` altındaki dosyalara git, gerektiğinde oku.

## 1. Proje

WooCommerce + Elementor benzeri e-ticaret/CMS platformu. Public repo: `alte-dev/alte-cms`. pnpm monorepo (pnpm 10.5.2, Node 22):

- `apps/medusa`: Medusa v2 (ürün, fiyat, stok, sipariş, ödeme). Port 9000.
- `apps/web`: Next.js 15 + Payload CMS 3 (içerik, sayfa, blog, menü) + Puck (görsel sayfa oluşturucu). Port 3100.
- `packages/shared`: ortak tipler.
- Veri: PostgreSQL 16, Redis 7. Tarayıcı `api.localhost:9000`, sunucu tarafı `127.0.0.1:9000`.
- Para birimi TRY. Tutarlar TL (decimal) cinsindendir, kuruş değil. KDV dahil fiyat. Fiyatın tek doğru kaynağı sunucudur, istemciden gelen fiyata asla güvenme.

Faz geçmişi ve kalan işler: `docs/PHASES.md`. Mimari: `docs/ARCHITECTURE.md`, güvenlik: `docs/SECURITY-DESIGN.md`, yetkiler: `docs/PERMISSIONS.md`, ödeme: `docs/PAYMENTS.md`, `docs/RUNBOOK*.md`.

## 2. Çalışma yöntemi (Superpowers zorunlu)

Her iş şu sırayı izler. Atlama:

1. `brainstorming`: belirsizliği sorularla gider. Büyük işte yazılı tasarım üret.
2. `using-git-worktrees`: işi `main`'den yeni dalda, ayrı çalışma dizininde yap.
3. `writing-plans`: 2-5 dakikalık küçük adımlar, her adımda dosya yolu ve doğrulama komutu.
4. `test-driven-development`: önce başarısız test, sonra minimum kod. Testsiz üretim kodu yazma.
5. `systematic-debugging`: hata varsa kök nedeni bul, tahminle yama yapma.
6. `requesting-code-review`: PR açmadan önce kendi işini kontrol listesine göre incele.
7. `verification-before-completion`: "bitti" demeden önce Bölüm 4'teki komutları GERÇEKTEN çalıştır.
8. `finishing-a-development-branch`.

Belirsiz bir şey varsa tahmin etme, soru sor. Kapsam dışına çıkma, ek özellik ekleme.

## 3. Değişmez kurallar

- Repo public. Gerçek anahtar, parola, token, IP, e-posta, müşteri verisi, gerçek alan adı YAZMA (kod, test, log, doküman, commit mesajı). Test verisi `example.test` ve sahte değerdir. Sır gerekiyorsa ortam değişkeni veya admin paneli ayarı (şifreli) kullan.
- `main`'e doğrudan push yok. Her iş ayrı dal + PR. Merge'i insan yapar, sen yapma. Conventional Commits kullan.
- Bağımlılıklar TAM sürüm pinli (`^` ve `~` yasak). Eklemeden önce `npm view` ve `pnpm audit` kontrol et. Yayınlanalı 2 haftadan az sürümü kullanma.
- GitHub Actions `uses:` satırları commit SHA'ya sabit. `pull_request_target` kullanma. Sahte veya doğrulanmamış SHA yazma, `git ls-remote` ile doğrula.
- Marka adı, alan adı, e-posta, URL kodda sabit yazılmaz. `site-settings`, ayar sayfası veya ortam değişkeninden gelir. Yedek değerler tarafsızdır (`"Mağaza"`, `http://localhost:3100`).
- Sunucuya (canlı makine) hiçbir şey kurma, bağlanma, komut çalıştırma. Her şey yerelde test edilir. Sunucu işi ancak insan açıkça isterse yapılır.
- Yetki ve güvenlik kontrolü fail-closed çalışır. Hata durumunda izin verme, reddet.

## 4. "Bitti" tanımı (kanıtsız bitti denmez)

Temiz klonda (`git clone` + `pnpm install --frozen-lockfile`) ve CI ile aynı ortam değişkenleriyle şunların HEPSİ geçer:

`pnpm format:check` · `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm audit --prod --audit-level=high` · gitleaks (tüm geçmiş)

Ek olarak ilgili canlı doğrulamalar gerçek Postgres/Redis/Medusa/web ile çalışır: `verify:store`, `verify:storefront`, `verify:checkout` (dev modunda), `verify:payments`, `verify:content`, `verify-search`, `verify-notifications`, `verify-order-ops`. Yeni özellik kendi `verify-*` betiğini getirir.

CI'nin GitHub'da yeşil olduğunu PR sayfasından/log'dan doğrula. Yerelde geçti demek yetmez. Her adımı (gitleaks, audit, build dahil) ayrı ayrı kontrol et.

## 5. Dürüstlük ve kanıt kuralları (geçmiş hatalardan)

Aşağıdakiler daha önce yaşandı. Tekrarlama:

- Ölçümü (bellek, süre, skor) UYDURMA. Gerçek ölçüm yoksa "ölçülmedi" yaz. Web için `next start`, Medusa için `medusa start` (build sonrası) ile ölç. Dev modu sayısı bütçe ölçümü değildir.
- Test, gerçek veriyle çalışmalı. Kütüphanenin gerçek ürettiği biçimi kullan (ör. Puck `props.id`). Kendi uydurduğun biçimle test yazma. Gerçek çıktıdan fixture üret.
- Bir adımın detayında "beklenen X, gelen Y" yazıyorsa adım PASS olamaz. PASS, gerçek koşula bağlıdır. Sonuç `count 0` iken "geçti" deme. Önce veriyi oluştur, sonra beklenen sayıyı ve sırayı doğrula.
- Hatayı sessizce yutma (`catch {}`, filtresiz yedek sorgu, "fallback" ile sahte başarı). Hata ya fırlatılır ya loglanır ve 5xx döner.
- Fonksiyonu süreç içinde çağırmak canlı HTTP doğrulaması değildir. Uç nokta testi gerçek HTTP isteğiyle yapılır (yetkisiz, yetkili, hatalı girdi, sınır değerleri).
- Doğrulama betiği temiz klonda, boş veritabanında, ısınma/bekleme hilesi olmadan çalışmalı.
- Güvenlik testi hem "kabul edilmemeli" hem "kabul edilmeli" yönünü kapsar. Geçerli girdiyi de dene (katı şema geçerli veriyi reddedebilir).
- Yapılamayan her maddeyi raporda açıkça listele. "Yapılamayan yok" demeden önce her maddeyi tek tek çalıştırıp çıktısını koy.
- Başka birinin kodunu/CI log'unu görmeden "yeşil" deme.

## 6. Alan kuralları (ihlal etme)

- **Ödeme:** PayTR callback'i HMAC (sabit zamanlı karşılaştırma) ile doğrulanır, idempotent ve kilitlidir (`paytr_cb_<oid>`). Tutar `>=` kontrolü yapılır. `ok_url` siparişi onaylamaz, yalnızca callback onaylar. Üretimde `pp_system_default` bağlı olamaz, `PAYTR_API_BASE`/`DEV_PAYTR_USER_IP` tanımlı olamaz (açılış koruması). PayTR anahtar/salt veritabanında AES-256-GCM şifreli, API'de yalnızca maskeli döner, loga düşmez. Otomatik iade yoktur, `needs_manual_refund` listesi kullanılır.
- **COD:** Kapıda ödeme bedeli sepette gerçek bir hizmet kalemidir (KDV'li), yalnızca sunucuda eklenir/çıkarılır. Varsayılan 100 TL, admin ayarından değişir. Kargo/COD eşikleri hizmet bedelini hariç tutar.
- **PII / KVKK:** Müşteri e-posta, ad, adres, telefon loga, günlüğe, CSV'ye, public API'ye ve yönetici bildirimine yazılmaz (yalnızca ilgili müşteri e-postasında ve sipariş kaydında). Alıcılar maskelenir. TC kimlik no saklanmaz.
- **Girdi:** Tüm girdi doğrulanır (zod). Kullanıcı girdisi HTML'e kaçırılarak basılır, `dangerouslySetInnerHTML` yok. Bağlantılar yalnızca `/` iç yol veya `https://` olabilir (`javascript:`, `data:`, `//host`, `\\host` reddedilir). SQL her zaman parametreli, her parametre tip dönüşümlüdür (`CAST`).
- **Yetki:** Rol matrisi `docs/PERMISSIONS.md`. Editor silemez, ayar/menü değiştiremez. Anonim yalnızca yayınlanmış içeriği okur, taslak hiçbir uç noktadan sızmaz (REST `draft`, `where`, `versions`, `depth` dahil). Sipariş sorgulama tek tip hata verir ve hız sınırlıdır.
- **Şema:** Payload tabloları yalnızca migration ile değişir (`payload migrate`). Medusa tabloları Medusa migration ile. Üretimde çalışma anında şema oluşturma/push yok. Alan eklersen migration üret ve commit et.
- **Rezerve slug'lar:** `urunler`, `urun`, `kategori`, `sepet`, `odeme`, `siparis-onay`, `blog`, `admin`, `api`, `sayfa`, `onizleme`, `ara`, `siparis-takip`.
- **Taşınabilirlik:** Dosya adı ve yol işlemlerinde yol gezinmesine karşı normalize et. SVG yükleme kapalı.

## 7. Performans ve bellek

Toplam bütçe ~1100 MB (Medusa heap 512, web 384, Redis/PG küçük ayarlı). Ağır servis ekleme (Meilisearch, Elasticsearch, Typesense yasak). Public sayfaların First Load JS değeri ~110 kB civarını aşmasın, Puck editör kodu public paketlere girmesin. Her fazda önce/sonra tablosu ver.

## 8. Rapor formatı (her iş sonunda)

Dal, PR numarası, GitHub CI adım adım sonucu, her madde için gerçek komut çıktısı, commit listesi, ölçümler (gerçek), yapılamayanların açık listesi. Kanıtsız madde "yapılmadı" sayılır. Rapor kısa ve olgusal olsun, süslü özet yazma.

## 9. Sıradaki iş

Mevcut durumu ve sıradaki fazı `docs/PHASES.md` içinden oku. İnsan söylemeden bir sonraki faza geçme.
