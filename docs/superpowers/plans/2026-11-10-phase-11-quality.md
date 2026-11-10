# FAZ 11 — Performans, Erişilebilirlik, SEO Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faz 11 gereksinimlerini (Medya 400 dönüşü, Lighthouse mobil ölçüm altyapısı, WCAG 2.1 AA erişilebilirlik, First Load JS bütçesi, revalidateTag önbellekleme, PostgreSQL indeksleme, JSON-LD ve Sitemap index) eksiksiz tamamlamak ve PR açmak.

**Architecture:** Next.js 15 App Router ve Payload CMS 3 üzerinde `ValidationError` ile istemci hata kodları, `@axe-core/playwright` ve `lighthouse` ile tarayıcı kalitesi, `revalidateTag` ile ISR önbellekleme, semantik HTML ve ARIA etiketleri ile erişilebilirlik.

**Tech Stack:** Next.js 15, Payload CMS 3, Medusa v2, PostgreSQL 16, Playwright 1.64.1, Axe-Core 4.14.0, Lighthouse 13.5.0, TypeScript, Vitest.

**Spec:** User prompt FAZ 11 and AGENTS.md.

## Global Constraints

- Bağımlılıklar TAM sürüm pinli (`^` ve `~` yasak). Yayınlanalı 2 haftadan eski sürümler.
- Repo public: Gerçek anahtar, parola, token, IP, PII içermez (`example.test` kullanılır).
- Fail-closed yetki ve güvenlik kontrolleri. SVG yükleme kesinlikle yasak.
- Ölçümler gerçek (uydurma yok, ölçülemeyen "ölçülmedi").
- Puck editör kodu public paketlere girmeyecek.

## Review Focus

1. SVG veya 5 MB üzeri dosya yüklendiğinde 500 değil HTTP 400 ValidationError dönmesi.
2. Axe-core taramasında genel sayfalarda 0 kritik ve 0 ciddi ihlal bulunması.
3. Klavye ile tüm vitrin akışının (arama, sepete ekleme, checkout formu) görünür odakla tamamlanabilmesi.
4. Payload içerik güncellemelerinin `revalidateTag` ile sayfayı yenilemesi, taslakların asla önbelleğe girmemesi.
5. Sitemap yapısının 50.000 URL sınırına uygun sitemap index mimarisi sunması.

---

### Task 1: 11.0b — Medya Yükleme Doğrulaması ve HTTP 400 Dönüşü

**Files:**

- Modify: `apps/web/src/collections/Media.ts`
- Modify: `apps/web/src/lib/media-utils.ts`
- Create: `apps/web/src/tests/media-upload-http.test.ts`
- Modify: `apps/web/src/tests/media-resizing.test.ts`

- [ ] **Step 1:** `apps/web/src/tests/media-upload-http.test.ts` içinde SVG yüklemesinin 400 ValidationError, 6 MB dosya yüklemesinin 400 ValidationError fırlattığını test eden testi yaz.
- [ ] **Step 2:** Testi çalıştırıp başarısız olduğunu doğrula (`pnpm --filter @alte/web test media-upload-http`).
- [ ] **Step 3:** `apps/web/src/collections/Media.ts` ve `apps/web/src/lib/media-utils.ts` içinde genel `Error` yerine `payload`'dan `ValidationError` fırlatacak şekilde güncelle.
- [ ] **Step 4:** Testleri çalıştır ve geçtiğini doğrula (`pnpm --filter @alte/web test`).
- [ ] **Step 5:** Commit: `fix(web): return 400 ValidationError for SVG and oversized media uploads`.

---

### Task 2: 11A — Lighthouse Ölçüm Altyapısı ve Baseline Raporu

**Files:**

- Modify: `package.json`
- Create: `scripts/measure-quality.ts`
- Create: `docs/QUALITY-BASELINE.md`

- [ ] **Step 1:** `package.json` devDependencies içine `"lighthouse": "13.5.0"` ve `"playwright": "1.64.1"` ekle, `pnpm install` çalıştır.
- [ ] **Step 2:** `scripts/measure-quality.ts` betiğini oluştur: Next.js production build (`next start`) ve Medusa üzerinde Playwright + Lighthouse ile mobil profilde 3'er çalıştırma yapıp medyan skorları ve metrikleri hesaplasın.
- [ ] **Step 3:** Betiği çalıştırarak gerçek ölçümleri al veya ölçülemeyenleri "ölçülmedi" olarak `docs/QUALITY-BASELINE.md` içine yaz.
- [ ] **Step 4:** Commit: `feat(scripts): add lighthouse mobile quality measurement runner and baseline docs`.

---

### Task 3: 11B — Erişilebilirlik (WCAG 2.1 AA)

**Files:**

- Modify: `package.json`
- Create: `apps/web/src/tests/a11y-axe.test.ts`
- Create: `apps/web/src/tests/keyboard-nav.test.ts`
- Modify: `apps/web/src/app/(store)/layout.tsx`
- Modify: `apps/web/src/components/Header.tsx`
- Modify: `apps/web/src/components/Footer.tsx`
- Modify: `apps/web/src/components/product/AddToCartButton.tsx`
- Modify: `apps/web/src/app/(store)/checkout/CheckoutForm.tsx`

- [ ] **Step 1:** Root `package.json` devDependencies içine `"@axe-core/playwright": "4.14.0"` ekle, `pnpm install` çalıştır.
- [ ] **Step 2:** `apps/web/src/tests/a11y-axe.test.ts` ve `apps/web/src/tests/keyboard-nav.test.ts` testlerini yaz.
- [ ] **Step 3:** `apps/web/src/app/(store)/layout.tsx` içine Türkçe skip-link ("İçeriğe geç" `#main-content`), `<main id="main-content">` landmark'ı ve odak halkası (`focus-visible`) stillerini ekle.
- [ ] **Step 4:** Form bileşenleri ve butonlarda `aria-label`, `aria-live="polite"`, `htmlFor` ve kontrast iyileştirmelerini yap.
- [ ] **Step 5:** Erişilebilirlik testlerini çalıştır ve geçtiğini doğrula.
- [ ] **Step 6:** Commit: `feat(web): enhance WCAG 2.1 AA compliance with skip-link, semantic landmarks, and keyboard navigation`.

---

### Task 4: 11C — Performans, Bundle Analizi, Fontlar ve Önbellekleme

**Files:**

- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/lib/cache-tags.ts`
- Create: `apps/web/src/app/api/revalidate/route.ts`
- Create: `apps/web/src/tests/cache-revalidation.test.ts`
- Modify: `docs/RUNBOOK-CACHE.md`

- [ ] **Step 1:** `apps/web/src/tests/cache-revalidation.test.ts` testini yaz (taslakların önbelleğe girmediğini, `revalidateTag` çağrıldığında etiketlerin temizlendiğini doğrula).
- [ ] **Step 2:** `apps/web/src/lib/cache-tags.ts` ve `apps/web/src/app/api/revalidate/route.ts` dosyalarını oluştur.
- [ ] **Step 3:** Next.js font ayarlarını `display: 'swap'` ve optimize ağırlıklarla yapılandır.
- [ ] **Step 4:** First Load JS paket boyutlarını `pnpm --filter @alte/web build` çıktısından analiz et ve ~110 kB bütçesini kontrol et.
- [ ] **Step 5:** PostgreSQL katalog/arama sorguları için `EXPLAIN ANALYZE` çıktısını alıp indeks kullanımını doğrula.
- [ ] **Step 6:** Commit: `feat(web): implement revalidateTag caching strategy, local fonts, and bundle optimization`.

---

### Task 5: 11D — SEO, JSON-LD, Sitemap Index ve Hata Sayfaları

**Files:**

- Create: `apps/web/src/tests/seo-jsonld.test.ts`
- Create: `apps/web/src/app/not-found.tsx`
- Create: `apps/web/src/app/error.tsx`
- Create: `apps/web/src/app/global-error.tsx`
- Modify: `apps/web/src/app/sitemap.ts`
- Modify: `apps/web/src/lib/seo.ts`

- [ ] **Step 1:** `apps/web/src/tests/seo-jsonld.test.ts` testini yaz: Product, BreadcrumbList, Article, Organization şemalarının geçerli JSON-LD ürettiğini, marka adının dinamik olduğunu doğrula.
- [ ] **Step 2:** Türkçe özel 404 (`not-found.tsx`) ve 500 (`error.tsx`, `global-error.tsx`) sayfalarını mağazaya dönüş bağlantılarıyla oluştur.
- [ ] **Step 3:** `sitemap.ts`'i 50.000 URL sınırına göre sitemap index desteğiyle, taslakları hariç tutacak ve rezerve slug kurallarına uyacak şekilde güncelle.
- [ ] **Step 4:** Robots meta ve canonical URL kurallarını uygula (taslak ve `/ara` noindex, nofollow).
- [ ] **Step 5:** Testleri çalıştır ve geçtiğini doğrula.
- [ ] **Step 6:** Commit: `feat(web): implement structured JSON-LD schemas, sitemap index, and custom error pages`.

---

### Task 6: Doğrulama, Regresyon Testleri ve PR

**Files:**

- Create: `scripts/verify-quality.ts`
- Modify: `docs/PHASES.md`

- [ ] **Step 1:** Canlı HTTP/tarayıcı doğrulama betiği `scripts/verify-quality.ts` yaz ve boş veritabanında çalıştır.
- [ ] **Step 2:** Regresyon testlerini çalıştır: `verify:store`, `verify:storefront`, `verify:checkout`, `verify:payments`, `verify:content`, `verify-search`, `verify-notifications`, `verify-order-ops`.
- [ ] **Step 3:** AGENTS.md Bölüm 4 kalite kapılarını çalıştır: `format:check`, `lint`, `typecheck`, `test`, `build`, `audit`, `gitleaks`.
- [ ] **Step 4:** Değişiklikleri push et, PR aç ve GitHub CI adım adım yeşil olduğunu doğrula.
- [ ] **Step 5:** AGENTS.md Bölüm 8 formatına uygun raporu kullanıcıya sun.
