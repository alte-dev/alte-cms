# Faz 10.1 — WooCommerce Müşteri ve Şifre Taşıma Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WooCommerce müşteri ve parola hash'lerini güvenli biçimde Medusa v2'ye taşıyan üretim doğrulayıcılarını, ortak akış tabanlı CSV içe aktarma çerçevesini, zayıf parola uyarısını ve canlı HTTP doğrulamasını kurmak.

**Architecture:** `bcryptjs` (pure JS, pinli) + özel `phpass`/MD5 doğrulayıcıları `defaultLegacyVerifierRegistry`'ye kaydedilir. `scripts/migration/` altında yeniden kullanılabilir CSV akış + 200 satırlık transaction parti çerçevesi ile `pnpm migrate:customers` çalışır. Mevcut `login`/`register`/`password`/`password-reset` rotaları legacy müşteriler, `needs_password_upgrade` boolean bayrağı ve sıfırlama akışıyla uyumlu hâle getirilir.

**Tech Stack:** TypeScript, Medusa v2, PostgreSQL (Knex), `bcryptjs@3.0.3`, Node `crypto`, Vitest, Next.js 15, `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-17-phase-10-1-customer-migration-design.md`

## Global Constraints

- Tüm bağımlılıklar tam sürüm pinli (`^` ve `~` yasak), `pnpm audit --prod --audit-level=high` temiz.
- Repo public: testlerde ve dokümanda yalnızca sahte (`example.test`) veri; gerçek hash, parola, e-posta, IP, alan adı yasak.
- `migration-data/` `.gitignore` içinde ve gitleaks temiz.
- Her test önce başarısız yazılır (TDD), sonra minimum kodla geçirilir.

## Review Focus

- `wp-bcrypt-sha384` için 72 bayt üzeri ve Türkçe karakterli parolalarda ön-hash doğruluğu, >4096 bayt parolada fail-closed reddetme.
- `$2y$` → `$2b$` dönüşümünün gerçek `$2y$` vektörüyle `bcryptjs` üzerinden doğrulanması.
- `password-reset/request` uç noktasının `emailpass` `provider_identity` kaydı olmayan taşınmış müşteriler için de çalışması.
- `--include-guests` olmadan misafir satırlarının atlanması; `--include-guests` ile aynı e-posta hem kayıtlı hem misafir ise kayıtlı olanın korunması; doğrulanmamış e-postada misafir siparişlerinin bağlanmaması.
- `needs_password_upgrade` bayrağının yalnızca boolean olması, parola değişimi ve şifre sıfırlama sonrası temizlenmesi.

---

### Task 1: `.gitignore` ve `bcryptjs` bağımlılığı + Üretim Parola Doğrulayıcıları

**Files:**

- Modify: `.gitignore`
- Modify: `apps/medusa/package.json`
- Create: `apps/medusa/src/modules/customer-account/verifiers/detect.ts`
- Create: `apps/medusa/src/modules/customer-account/verifiers/wp-bcrypt-sha384.ts`
- Create: `apps/medusa/src/modules/customer-account/verifiers/bcrypt.ts`
- Create: `apps/medusa/src/modules/customer-account/verifiers/phpass.ts`
- Create: `apps/medusa/src/modules/customer-account/verifiers/md5.ts`
- Modify: `apps/medusa/src/modules/customer-account/verifiers/registry.ts`
- Test: `apps/medusa/src/modules/customer-account/verifiers/verifiers.test.ts`

- [ ] **Step 1:** `.gitignore` içine `migration-data/` ekle ve `apps/medusa/package.json` `dependencies` altına `"bcryptjs": "3.0.3"` ekleyip `pnpm install` ile lockfile'ı güncelle.
- [ ] **Step 2:** `verifiers.test.ts` dosyasında başarısız birim testlerini yaz: `detectLegacyAlgorithm`, `wp-bcrypt-sha384` (normal, >72 bayt, Türkçe `İşçi-Şifre-ğüö`, >4096 bayt, yanlış/boş/bozuk hash), `bcrypt` (`$2y$` gerçek vektörü, `$2a$`, `$2b$`, 72 bayt sınırı), `phpass` (bilinen açık `$P$` ve `$H$` vektörleri), `md5` (32 hex, sabit zamanlı, büyük/küçük harf).
- [ ] **Step 3:** `pnpm --filter @alte/medusa test` çalıştır ve testlerin başarısız olduğunu doğrula.
- [ ] **Step 4:** `detect.ts`, `wp-bcrypt-sha384.ts`, `bcrypt.ts`, `phpass.ts`, `md5.ts` dosyalarını yaz ve `registry.ts` içinde `defaultLegacyVerifierRegistry`'ye kaydet.
- [ ] **Step 5:** `pnpm --filter @alte/medusa test` çalıştır ve tüm birim testlerinin geçtiğini doğrula.

---

### Task 2: Ortak CSV İçe Aktarma Çerçevesi ve `pnpm migrate:customers`

**Files:**

- Create: `scripts/migration/types.ts`
- Create: `scripts/migration/sanitize.ts`
- Create: `scripts/migration/csv-stream.ts`
- Create: `scripts/migration/db-guard.ts`
- Create: `scripts/migration/report.ts`
- Create: `scripts/migration/batch-runner.ts`
- Create: `scripts/migration/import-customers.ts`
- Create: `scripts/migration/import-customers.test.ts`
- Modify: `package.json` (`"migrate:customers": "tsx scripts/migration/import-customers.ts"`)

- [ ] **Step 1:** `import-customers.test.ts` içinde başarısız testleri yaz: CSV akış ayrıştırma, e-posta normalizasyonu, CSV formül enjeksiyonu (`=`, `+`, `-`, `@`), NUL/aşırı uzunluk/Türkçe karakter, maskeli rapor çıktısı (tam e-posta/hash/parola yok), `--confirm-database` ve `--allow-production` koruması, kuru çalıştırma (0 yazım), `--apply` idempotency, `--include-guests` davranışı ve kayıtlı>misafir önceliği.
- [ ] **Step 2:** Testleri çalıştır ve başarısız olduğunu doğrula.
- [ ] **Step 3:** Çerçeve modüllerini (`types.ts`, `sanitize.ts`, `csv-stream.ts`, `db-guard.ts`, `report.ts`, `batch-runner.ts`) ve `import-customers.ts` betiğini yaz.
- [ ] **Step 4:** Birim testlerini çalıştır ve geçtiğini doğrula.

---

### Task 3: Giriş, Zayıf Parola Bayrağı, Şifre Sıfırlama ve `/hesap` Uyarısı

**Files:**

- Modify: `apps/medusa/src/api/store/account/login/route.ts`
- Modify: `apps/medusa/src/api/store/account/me/route.ts`
- Modify: `apps/medusa/src/api/store/account/password/route.ts`
- Modify: `apps/medusa/src/api/store/account/password-reset/request/route.ts`
- Modify: `apps/medusa/src/api/store/account/password-reset/confirm/route.ts`
- Modify: `apps/web/src/lib/medusa/account.ts`
- Modify: `apps/web/src/components/account/AccountShell.tsx`
- Modify: `apps/web/src/app/(store)/hesap/page.tsx`
- Test: `apps/medusa/src/api/store/account/legacy-migration-routes.test.ts`

- [ ] **Step 1:** `legacy-migration-routes.test.ts` içinde başarısız testleri yaz: `needs_password_upgrade` boolean işaretlemesi (zayıf eski parolada `true`, güçlüde `false`/yok), parola değiştirme ve sıfırlama onayında temizlenmesi, `password-reset/request` içinde `emailpass` provider'ı olmayan taşınmış müşteri için token üretimi.
- [ ] **Step 2:** Testleri çalıştır ve başarısız olduğunu doğrula.
- [ ] **Step 3:** Medusa API rotalarını ve web `AccountShell` uyarı bandını güncelle.
- [ ] **Step 4:** Testleri çalıştır ve geçtiğini doğrula.

---

### Task 4: Canlı Doğrulama Betiği (`verify:migration`) ve CI Entegrasyonu

**Files:**

- Create: `scripts/verify-migration.ts`
- Modify: `package.json` (`"verify:migration": "tsx scripts/verify-migration.ts"`)
- Modify: `scripts/verify-all.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1:** `scripts/verify-migration.ts` betiğini `scripts/lib/verify-step.ts` kalıbıyla yaz:
  - Kuru çalıştırma → DB'de 0 yeni müşteri,
  - Sahte SMTP sink'i ile `--apply --confirm-database ...` → 0 e-posta,
  - Her 4 algoritma için web BFF üzerinden gerçek HTTP giriş (200), ikinci giriş (200, legacy satırı silinmiş), yanlış parola (401, legacy satırı duruyor),
  - Zayıf legacy parolalı müşteride `/api/account/me` `needs_password_upgrade: true`, parola değişimi sonrası `false`,
  - Tanınmayan/hash'siz müşteride şifremi unuttum akışıyla sıfırlama + giriş,
  - İçe aktarılmış e-postayla kayıt denemesi (202, tek kayıt, legacy değişmemiş),
  - Hız sınırı (429),
  - `--include-guests` ve doğrulanmamış e-postada misafir siparişinin bağlanmaması,
  - `email_log`, log ve rapor dosyalarında hash/parola/tam e-posta taraması.
- [ ] **Step 2:** `verify-all.ts` ve `.github/workflows/ci.yml` (`live-verify`) içine `verify:migration` ekle.
- [ ] **Step 3:** `pnpm check:verify-scripts` çalıştır ve geçtiğini doğrula.

---

### Task 5: Dokümantasyon, Bellek/JS Ölçümü, Tam Kalite Kontrolleri ve PR

**Files:**

- Modify: `docs/MIGRATION-WOOCOMMERCE.md`
- Modify: `docs/SECURITY-DESIGN.md`
- Modify: `docs/PHASES.md`
- Modify: `docs/RUNBOOK.md`

- [ ] **Step 1:** `docs/MIGRATION-WOOCOMMERCE.md` (HPOS + kayıtlı/misafir SQL sorguları, CSV şeması, yerel tek satır deneme adımları, rollback/temizleme komutu), `docs/SECURITY-DESIGN.md` (WordPress `pluggable.php` satır referansı, `bcryptjs` vs özel `phpass`, zayıf parola ve doğrulama kararları), `docs/PHASES.md` (10.1–10.4 bölümü), `docs/RUNBOOK.md` güncelle.
- [ ] **Step 2:** `pnpm format:check`, `pnpm lint`, `pnpm check:baseline`, `pnpm check:verify-scripts`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit --prod --audit-level=high`, gitleaks çalıştır.
- [ ] **Step 3:** Boş yerel DB'de `VERIFY_ALLOW_DB_MUTATION=true pnpm verify:all` ve bellek ölçümü (10.000 satır CSV içe aktarma + `medusa start` / `next start`) çalıştır.
- [ ] **Step 4:** Dalı pushla, PR aç, GitHub CI (`security-and-quality` + `live-verify`) yeşil olduğunu doğrula ve raporu sun.
