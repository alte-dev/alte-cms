# FAZ 11.0 — Taşınan Düzeltmeler (Carryover) Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #19 doğrulamasından taşınan sharp bağımlılığı, Payload medya yeniden boyutlandırma, verify-content.ts idempotency düzeltmesi ve next/image lint temizliklerini tamamlayıp PR açmak.

---

### Task 1: Sharp Bağımlılığı ve Medya Boyutlandırma (TDD)

- [ ] **Step 1.1:** `apps/web/src/tests/media-resizing.test.ts` dosyasını oluştur. Payload `Media` koleksiyonunun yapılandırmasını (thumbnail: 400, card: 800, hero: 1600 boyutları, mimeType kısıtlamaları, maxFileSize, alt zorunluluğu) test eden başarısız testi yaz.
- [ ] **Step 1.2:** Testi çalıştır ve başarısız olduğunu doğrula (`pnpm --filter @alte/web test src/tests/media-resizing.test.ts`).
- [ ] **Step 1.3:** `apps/web/package.json` içine `"sharp": "0.35.5"` bağımlılığını ekle ve `pnpm install --frozen-lockfile` (veya `pnpm install`) çalıştır.
- [ ] **Step 1.4:** `apps/web/src/payload.config.ts` içine `import sharp from "sharp"` ekle ve `buildConfig({ sharp, ... })` olarak ver.
- [ ] **Step 1.5:** Testi yeniden çalıştır ve geçtiğini doğrula.
- [ ] **Step 1.6:** `payload generate:types` ve `payload generate:db-schema` çalıştırarak şemanın temiz olduğunu doğrula.

### Task 2: verify-content.ts Adım 2 İdempotency Düzeltmesi

- [ ] **Step 2.1:** `scripts/verify-content.ts` dosyasındaki Step 2 bloğunu incele. 1. çalıştırma öncesi değil, 1. çalıştırma sonrası ile 2. çalıştırma sonrası toplam belge sayılarını karşılaştıracak şekilde düzenle.
- [ ] **Step 2.2:** `pnpm format` ile dosyayı biçimlendir.

### Task 3: <img> Etiketlerinin next/image ile Değiştirilmesi ve Lint Temizliği

- [ ] **Step 3.1:** `apps/web/next.config.ts` dosyasına `images.remotePatterns` ekle (yalnızca yerel ve yapılandırılmış sunucu URL'si: `/api/media/file/**`).
- [ ] **Step 3.2:** `apps/web/src/app/(store)/blog/[slug]/page.tsx` içindeki raw `<img>` etiketini `next/image` (`Image`) ile değiştir (genişlik, yükseklik veya fill, alt koruması).
- [ ] **Step 3.3:** `apps/web/src/app/(store)/blog/kategori/[slug]/page.tsx` içindeki `<img>` etiketini `Image` ile değiştir.
- [ ] **Step 3.4:** `apps/web/src/app/(store)/blog/page.tsx` içindeki `<img>` etiketini `Image` ile değiştir.
- [ ] **Step 3.5:** `apps/web/src/components/blog/LexicalRenderer.tsx` içindeki `<img>` etiketini `Image` ile değiştir.
- [ ] **Step 3.6:** `apps/web/src/lib/puck/components.tsx` içindeki `<img>` etiketini `Image` ile değiştir.
- [ ] **Step 3.7:** `pnpm lint` çalıştırarak 0 hata ve 0 uyarı olduğunu doğrula.

### Task 4: Doğrulama, Git Commit ve PR

- [ ] **Step 4.1:** `pnpm format:check` çalıştır.
- [ ] **Step 4.2:** `pnpm lint` çalıştır.
- [ ] **Step 4.3:** `pnpm typecheck` çalıştır.
- [ ] **Step 4.4:** `pnpm test` çalıştır.
- [ ] **Step 4.5:** `pnpm build` çalıştır.
- [ ] **Step 4.6:** `pnpm audit --prod --audit-level=high` çalıştır.
- [ ] **Step 4.7:** Canlı ortamda `pnpm verify:content` çalıştır (12/12 PASS).
- [ ] **Step 4.8:** Conventional Commits ile commit yap ve `phase-11-0-carryover` dalını GitHub'a push et.
- [ ] **Step 4.9:** `gh pr create` ile PR oluştur ve GitHub CI adımlarının yeşil olduğunu doğrula.
