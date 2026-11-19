# Çerez Onay Altyapısı (KVKK Opt-In) Tasarımı

## Amaç ve Neden

Türkiye KVKK Çerez Uygulamaları Rehberi uyarınca zorunlu olmayan çerezler ve üçüncü parti gömülü içerikler (halihazırda `/iletisim` sayfasındaki Google Maps iframe'i ve ileride eklenecek analitik/pazarlama araçları) ziyaretçinin **açık rızası (opt-in)** olmadan yüklenmemelidir. Hem yasal uyum hem de ileride GA4 / Meta Pixel gibi araçlara hazır olmak için yerleşik, hafif ve sıfır dış bağımlılıklı bir çerez onay altyapısı kurulacaktır.

## Hedefler ve Kapsam Dışı

- **Hedefler:**
  - İlk ziyarette alt bantta eşit görünürlükte **"Tümünü Reddet"**, **"Tümünü Kabul Et"** ve **"Tercihleri Yönet"** seçenekleri.
  - 4 kategori: `necessary` (her zaman açık), `functional` (varsayılan kapalı), `analytics` (varsayılan kapalı), `marketing` (varsayılan kapalı).
  - Rıza tercihinin birinci parti çerezde (`alte_cookie_consent`, `SameSite=Lax`, 180 gün, sürüm numaralı JSON) tutulması ve SSR'da okunarak sayfa açılışında yanıp sönmenin (flash) önlenmesi.
  - `/iletisim` sayfasındaki Google Maps iframe'inin `functional` izni olmadan yüklenmemesi; yerine tek tıkla izin verilebilen kart gösterilmesi.
  - İleride eklenecek script/bileşenler için `ConsentGate` bileşeni, `useCookieConsent()` kancası ve `alte:cookie-consent-change` pencere olayı.
  - Footer'da her zaman erişilebilir **"Çerez Tercihleri"** butonu.
  - Payload `SiteSettings` altında admin ayarları (`enabled`, `policyVersion`, `bannerTitle`, `bannerDescription`, `policyUrl`) + migration + taslak `cerez-politikasi` hukuk sayfası.
  - WCAG 2.1 AA uyumluluğu (klavye gezintisi, `Escape` ile kapatma, `role="dialog"`, Axe-core sıfır kritik/ciddi ihlal).
- **Kapsam Dışı:**
  - Sunucu tarafı veritabanı rıza günlüğü (Approaches bölümünde elendi).
  - Harici 3. parti CMP (Cookiebot/CookieYes vb.) entegrasyonu.
  - GA4 veya Meta Pixel'in kendisinin eklenmesi (yalnızca rıza kapısı hazır bırakılır).

## Değerlendirilen Yaklaşımlar

1. **Yaklaşım 1 — Yerleşik hafif rıza altyapısı + Payload `SiteSettings` (Seçilen):** Harici paket yok (~2–3 kB), First Load JS bütçesini korur, dış sunucuya veri sızdırmaz, SSR uyumlu, KVKK opt-in ve engelleme kurallarını tam karşılar.
2. **Yaklaşım 2 — Yaklaşım 1 + Veritabanı rıza günlüğü:** Ek tablo, migration ve anonim trafikte DB yazma/bot koruması karmaşıklığı eklediği için seçilmedi.
3. **Yaklaşım 3 — Harici 3. parti CMP:** Ücretli, CSP gevşetmesi gerektirir, performansı düşürür ve ziyaretçi verisini yurt dışına gönderir; elendi.

## Teknik Sözleşme

- **Çerez adı:** `alte_cookie_consent`, `Max-Age=15552000` (180 gün), `Path=/`, `SameSite=Lax`, HTTPS'te `Secure`.
- **Değer biçimi:** URL-encoded JSON `{ v: number, necessary: true, functional: boolean, analytics: boolean, marketing: boolean, updatedAt: string }`.
- **Güvenlik:** Bozuk/1024 bayttan uzun çerezler sessizce `null` (rıza yok — fail-closed) kabul edilir. `policyUrl` her zaman `safeHref` ile doğrulanır.
- **Doğrulama:** Birim testleri (`cookie-consent.test.ts`), canlı HTTP + Playwright + Axe-core betiği (`scripts/verify-cookie-consent.ts`, `verify:all` içinde), `scripts/verify-contact.ts` güncellemesi.
