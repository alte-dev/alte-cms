# Faz 12 — Müşteri Hesabı Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Medusa v2 customer accounts (`emailpass`) with httpOnly server-managed sessions, email verification, single-use password reset, KVKK consent & anonymization, checkout integration, WooCommerce migration hooks, and live HTTP/browser verification.

**Architecture:** Medusa-centered (`customer-account` module + migrations + fail-closed middlewares + `/store/account/*` routes) with a thin Next.js BFF (`/api/account/*`) holding the `alte_customer_session` httpOnly cookie, enforcing Origin/Host checks, and forwarding `X-Alte-Internal` + `X-Alte-Client-IP`. Public pages remain statically/ISR-optimized without bundling account client JS.

**Tech Stack:** Medusa v2 (2.22.4), Next.js 15, TypeScript, Zod, Vitest, Playwright + Axe-core, PostgreSQL 16, Node `crypto`.

**Spec:** `docs/superpowers/specs/2026-11-11-customer-accounts-design.md`

## Global Constraints

- Exact pinned dependency versions (`^` and `~` forbidden); no new external dependencies required.
- Fail-closed `INTERNAL_API_SECRET` (>= 32 chars, no weak defaults) required in both `@alte/medusa` and `@alte/web`.
- Passwords >= 10 and <= 128 chars, rejected if in local common-passwords list (~1000 entries) or containing email local-part; never logged or returned in errors.
- No customer PII (email, name, phone, address) in server logs, `email_log`, CSV exports, or admin notifications.
- `customer.metadata` is never used for `email_verified_at` or legacy password hashes.
- `hesap` is a reserved slug across Payload `Pages`, `slugify.ts`, `sitemap.ts`, `AGENTS.md`, and tests.
- Every verification script runs against a clean DB via real HTTP and exits non-zero on failure.

## Review Focus

- **Unverified account order isolation:** Guest orders matching an account's email MUST NOT appear until `email_verified_at` is set, and `linkGuestOrdersForCustomer` must fail-closed if called for an unverified account.
- **Direct Medusa Store API bypass:** Calling `GET /store/orders/:id`, `POST /auth/customer/emailpass/register`, or `POST /store/orders/:id/transfer/*` directly without `X-Alte-Internal` or valid ownership must return `404`.
- **Single-use password reset & verification tokens:** Reusing a consumed token, using an expired token, or using an old session cookie after logout/password-reset/account-deletion must fail with `400`/`401`.
- **User enumeration & timing:** Register, login, and password-reset must return identical response bodies and similar median latencies (< 150 ms difference) for existing vs non-existing emails.
- **Origin/Host CSRF guard:** State-changing `/api/account/*` requests with missing or non-allowed `Origin` (outside `NEXT_PUBLIC_SERVER_URL`) must return `403`.

---

### Task 1: Shared Password Policy & Reserved Slug (`hesap`)

**Files:**
- Create: `packages/shared/src/password-policy.ts`
- Create: `packages/shared/src/common-passwords.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/__tests__/password-policy.test.ts`
- Modify: `apps/web/src/lib/slugify.ts`
- Modify: `apps/web/src/app/sitemap.ts`
- Modify: `apps/web/src/tests/slugify.test.ts`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: `validateCustomerPassword(password: string, email?: string): { valid: boolean; error?: string }` in `@alte/shared`
- Produces: `RESERVED_SLUGS` including `"hesap"` in `apps/web/src/lib/slugify.ts` and `apps/web/src/app/sitemap.ts`

- [ ] **Step 1: Write failing tests for password policy and reserved slug `hesap`**
  - Test `validateCustomerPassword`: rejects `< 10` chars, `> 128` chars, common passwords (`"password1234"`, `"1234567890"`, `"qwerty12345"`), password containing email local-part (`"ali.yilmaz99"` for `"ali.yilmaz@example.test"`); accepts valid 10+ char password (`"Guv3nli!Parola2026"`).
  - Test `isReservedSlug("hesap") === true` in `apps/web/src/tests/slugify.test.ts`.
- [ ] **Step 2: Run tests to verify failure**
  - `pnpm --filter @alte/shared test` and `pnpm --filter @alte/web test -- slugify`
- [ ] **Step 3: Implement password policy & add `hesap` to reserved slugs**
  - Create `packages/shared/src/common-passwords.ts` (normalized lowercase Set of ~1000 common passwords, public domain/SecLists-derived).
  - Create `packages/shared/src/password-policy.ts` exporting `validateCustomerPassword(password: string, email?: string)`.
  - Export from `packages/shared/src/index.ts`.
  - Add `"hesap"` to `RESERVED_SLUGS` in `apps/web/src/lib/slugify.ts`, `apps/web/src/app/sitemap.ts`, and `AGENTS.md`.
- [ ] **Step 4: Run tests and build `@alte/shared`**
  - `pnpm --filter @alte/shared build && pnpm --filter @alte/shared test && pnpm --filter @alte/web test -- slugify`
- [ ] **Step 5: Commit**
  - `git commit -m "feat(shared): add customer password policy and reserve hesap slug"`

---

### Task 2: `INTERNAL_API_SECRET` Fail-Closed Env Validation & CI Env

**Files:**
- Modify: `apps/medusa/src/env.ts`
- Modify: `apps/medusa/src/env.test.ts`
- Modify: `apps/web/src/env.ts`
- Modify: `apps/web/src/tests/env.test.ts`
- Modify: `apps/medusa/.env.example`
- Modify: `apps/web/.env.example`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `env.INTERNAL_API_SECRET` (validated >= 32 chars, not weak) in both `validateMedusaEnv()` and `validateWebEnv()`

- [ ] **Step 1: Write failing env tests**
  - Test `validateMedusaEnv` and `validateWebEnv` throw when `INTERNAL_API_SECRET` is missing, `< 32` chars, or starts with weak pattern (`"secret..."`), and succeed when >= 32 random chars.
- [ ] **Step 2: Run tests to verify failure**
  - `pnpm --filter @alte/medusa test -- env` and `pnpm --filter @alte/web test -- env`
- [ ] **Step 3: Add `INTERNAL_API_SECRET` to env schemas, `.env.example`, and `.github/workflows/ci.yml`**
  - Also update local untracked `apps/medusa/.env` and `apps/web/.env` in worktree with dummy 32+ char `INTERNAL_API_SECRET` for local testing.
- [ ] **Step 4: Run env tests**
  - `pnpm --filter @alte/medusa test -- env && pnpm --filter @alte/web test -- env`
- [ ] **Step 5: Commit**
  - `git commit -m "feat(security): enforce INTERNAL_API_SECRET in medusa and web env"`

---

### Task 3: Shared Rate Limiter & `order-tracking` Refactor

**Files:**
- Create: `apps/medusa/src/utils/rate-limiter.ts`
- Create: `apps/medusa/src/utils/rate-limiter.test.ts`
- Modify: `apps/medusa/src/api/store/order-tracking/route.ts`

**Interfaces:**
- Produces: `FixedWindowRateLimiter` (`check(key)`, `consume(key)`, `reset(key)`) and `BruteForceGuard` (`isBlocked(key)`, `recordFailure(key)`, `clear(key)`) with injectable `now: () => number` and expired-entry pruning.

- [ ] **Step 1: Write failing unit tests for `FixedWindowRateLimiter` & `BruteForceGuard`**
  - Test window limit allowance/rejection, window expiry with fake clock, brute force lock after N failures, clear on success, and pruning expired entries.
- [ ] **Step 2: Run test to verify failure**
  - `pnpm --filter @alte/medusa test -- rate-limiter`
- [ ] **Step 3: Implement `rate-limiter.ts` and refactor `order-tracking/route.ts`**
- [ ] **Step 4: Run tests**
  - `pnpm --filter @alte/medusa test -- rate-limiter`
- [ ] **Step 5: Commit**
  - `git commit -m "refactor(medusa): extract shared rate-limiter utility"`

---

### Task 4: Medusa `customer-account` Module (Models, Migration, Legacy Verifier Hook, Service)

**Files:**
- Create: `apps/medusa/src/modules/customer-account/models/customer-account-state.ts`
- Create: `apps/medusa/src/modules/customer-account/models/customer-session.ts`
- Create: `apps/medusa/src/modules/customer-account/models/customer-email-verification.ts`
- Create: `apps/medusa/src/modules/customer-account/models/customer-password-reset.ts`
- Create: `apps/medusa/src/modules/customer-account/models/customer-consent.ts`
- Create: `apps/medusa/src/modules/customer-account/models/customer-legacy-credential.ts`
- Create: `apps/medusa/src/modules/customer-account/verifiers/types.ts`
- Create: `apps/medusa/src/modules/customer-account/verifiers/registry.ts`
- Create: `apps/medusa/src/modules/customer-account/verifiers/registry.test.ts`
- Create: `apps/medusa/src/modules/customer-account/service.ts`
- Create: `apps/medusa/src/modules/customer-account/service.test.ts`
- Create: `apps/medusa/src/modules/customer-account/index.ts`
- Create: `apps/medusa/src/modules/customer-account/migrations/Migration20261114000000.ts`
- Modify: `apps/medusa/medusa-config.ts`

**Interfaces:**
- Produces: `CUSTOMER_ACCOUNT_MODULE = "customerAccount"`
- Produces: `LegacyPasswordVerifier`, `LegacyVerifierRegistry` (rejects `"fake-test"` in `NODE_ENV === "production"`)
- Produces: `CustomerAccountModuleService`:
  - `hashToken(raw: string): string`, `generateOpaqueToken(): { raw: string; hash: string }`
  - `hashEmailLookup(email: string): string` (HMAC-SHA256 using `SETTINGS_ENCRYPTION_KEY`)
  - `createSession(customerId: string, jwt: string)`, `validateSession(jwt: string)`, `revokeSession(jwt: string)`, `revokeAllSessions(customerId: string)`
  - `createEmailVerificationToken(customerId: string)`, `consumeEmailVerificationToken(rawToken: string)`
  - `storePasswordResetToken(customerId: string, rawToken: string)`, `consumePasswordResetToken(rawToken: string)`
  - `recordConsents(customerId: string, input: { kvkkVersion: string; marketingGranted: boolean; marketingVersion: string })`
  - `setLegacyCredential(customerId: string, email: string, algorithm: string, legacyHash: string)`
  - `findLegacyCredentialByEmail(email: string)`, `verifyLegacyPassword(email: string, password: string)`, `deleteLegacyCredential(customerId: string)`
  - `linkOrdersToCustomer(pgConnection, customerId: string, orderIds: string[])` (Faz 10 hook)
  - `linkGuestOrdersForVerifiedCustomer(pgConnection, customerId: string, email: string)` (fails closed if `email_verified_at` is null)
  - `anonymizeCustomerData(pgConnection, customerId: string, email: string)`

- [ ] **Step 1: Write failing unit tests for `LegacyVerifierRegistry`, token/crypto helpers, and `linkGuestOrdersForVerifiedCustomer` fail-closed guard**
- [ ] **Step 2: Run tests to verify failure**
  - `pnpm --filter @alte/medusa test -- verifiers customer-account`
- [ ] **Step 3: Implement models, verifier registry, service, module definition, and migration**
  - Register `customer-account` module in `apps/medusa/medusa-config.ts`.
  - Test migration on Postgres (`pnpm --filter @alte/medusa db:migrate`).
- [ ] **Step 4: Run unit tests**
  - `pnpm --filter @alte/medusa test`
- [ ] **Step 5: Commit**
  - `git commit -m "feat(medusa): add customer-account module, migration, and legacy verifier hook"`

---

### Task 5: Medusa Fail-Closed Middlewares & Direct Store API Protection

**Files:**
- Create: `apps/medusa/src/api/middlewares.ts`
- Create: `apps/medusa/src/api/middlewares.test.ts`

**Interfaces:**
- Enforces:
  - `/auth/customer/*` and `/auth/token/refresh` (when `actor_type=customer`): require `X-Alte-Internal` (`constantTimeCompare`), else `404`.
  - `/store/account/*`: require `X-Alte-Internal`, else `404`.
  - `POST /store/customers`: require `X-Alte-Internal`, else `404`.
  - `/store/orders/:id/transfer/*`: always `404`.
  - `GET /store/orders/:id`: allow if valid `X-Alte-Internal` OR (authenticated customer session AND `order.customer_id === auth_context.actor_id`), else `404`.
  - Any route with `Authorization: Bearer <jwt>` where `actor_type === "customer"`: verify active row in `customer_session` (not revoked, not expired, not idle > 24h), else `401`.

- [ ] **Step 1: Write failing unit tests for middleware guards (missing/wrong internal secret -> 404, revoked session -> 401, non-owner order -> 404, valid owner / internal secret -> next)**
- [ ] **Step 2: Run tests to verify failure**
  - `pnpm --filter @alte/medusa test -- middlewares`
- [ ] **Step 3: Implement `apps/medusa/src/api/middlewares.ts`**
- [ ] **Step 4: Run tests**
  - `pnpm --filter @alte/medusa test -- middlewares`
- [ ] **Step 5: Commit**
  - `git commit -m "feat(medusa): add fail-closed account, session, and order ownership middlewares"`

---

### Task 6: Medusa `/store/account/*` Routes & Email Subscriber

**Files:**
- Create: `apps/medusa/src/utils/timing-floor.ts`
- Create: `apps/medusa/src/api/store/account/register/route.ts`
- Create: `apps/medusa/src/api/store/account/login/route.ts`
- Create: `apps/medusa/src/api/store/account/logout/route.ts`
- Create: `apps/medusa/src/api/store/account/me/route.ts`
- Create: `apps/medusa/src/api/store/account/verify-email/route.ts`
- Create: `apps/medusa/src/api/store/account/verify-email/resend/route.ts`
- Create: `apps/medusa/src/api/store/account/password-reset/request/route.ts`
- Create: `apps/medusa/src/api/store/account/password-reset/confirm/route.ts`
- Create: `apps/medusa/src/api/store/account/password/route.ts`
- Create: `apps/medusa/src/api/store/account/delete/route.ts`
- Create: `apps/medusa/src/subscribers/customer-account-emails.ts`
- Modify: `apps/medusa/src/services/email-service.ts` (export helper to send account transactional emails with `maskEmail` in `email_log` and zero PII/token in logs)
- Create: `apps/medusa/src/utils/timing-floor.test.ts`

- [ ] **Step 1: Write failing tests for timing floor helper & account email template sanitization (no raw token/PII in `email_log`)**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement `/store/account/*` routes and `customer-account-emails.ts` subscriber**
  - Ensure rate limiting on `login` (5 failed/15m IP+email, 30/15m IP), `register` (5/hr IP), `password-reset/request` (3/hr email, 10/hr IP), `password-reset/confirm` (10/15m IP), `verify-email` (10/15m IP), `verify-email/resend` (3/hr customer).
  - Ensure timing floor (`ACCOUNT_RESPONSE_FLOOR_MS`, default 900 ms) + dummy scrypt on non-existent email login.
  - Ensure zero password/PII in logs or error responses.
- [ ] **Step 4: Run `pnpm --filter @alte/medusa typecheck && pnpm --filter @alte/medusa test`**
- [ ] **Step 5: Commit**
  - `git commit -m "feat(medusa): add /store/account endpoints and email subscriber"`

---

### Task 7: Web Origin/Host Guard, Cookie Helpers, BFF Client & `/api/account/*` Routes

**Files:**
- Create: `apps/web/src/lib/security/origin-guard.ts`
- Create: `apps/web/src/tests/origin-guard.test.ts`
- Modify: `apps/web/src/lib/medusa/cookies.ts`
- Create: `apps/web/src/lib/medusa/account.ts`
- Create: `apps/web/src/lib/payload/kvkk-version.ts`
- Create: `apps/web/src/app/api/account/register/route.ts`
- Create: `apps/web/src/app/api/account/login/route.ts`
- Create: `apps/web/src/app/api/account/logout/route.ts`
- Create: `apps/web/src/app/api/account/me/route.ts`
- Create: `apps/web/src/app/api/account/profile/route.ts`
- Create: `apps/web/src/app/api/account/addresses/route.ts`
- Create: `apps/web/src/app/api/account/addresses/[id]/route.ts`
- Create: `apps/web/src/app/api/account/orders/route.ts`
- Create: `apps/web/src/app/api/account/orders/[id]/route.ts`
- Create: `apps/web/src/app/api/account/verify-email/route.ts`
- Create: `apps/web/src/app/api/account/verify-email/resend/route.ts`
- Create: `apps/web/src/app/api/account/password-reset/route.ts`
- Create: `apps/web/src/app/api/account/password-reset/confirm/route.ts`
- Create: `apps/web/src/app/api/account/password/route.ts`
- Create: `apps/web/src/app/api/account/delete/route.ts`

- [ ] **Step 1: Write failing unit tests for `verifyAccountOrigin(req)` (missing Origin -> 403, foreign Origin -> 403, mismatched Host -> 403, valid `NEXT_PUBLIC_SERVER_URL` Origin + Host -> allowed)**
- [ ] **Step 2: Run test to verify failure**
  - `pnpm --filter @alte/web test -- origin-guard`
- [ ] **Step 3: Implement `origin-guard.ts`, session cookie helpers, `kvkk-version.ts`, `account.ts`, and all `/api/account/*` handlers**
  - On `/api/account/login`: if `cart_id` cookie exists, call Medusa `POST /store/carts/:id/customer` with customer JWT; log non-PII warning on error, keep login successful and keep `cart_id`.
  - On any `401` from Medusa for customer session: delete `alte_customer_session` cookie.
- [ ] **Step 4: Run unit tests & typecheck**
  - `pnpm --filter @alte/web test -- origin-guard && pnpm --filter @alte/web typecheck`
- [ ] **Step 5: Commit**
  - `git commit -m "feat(web): add customer account BFF routes, cookie session, and origin guard"`

---

### Task 8: Web `/hesap/...` Pages, Headers & Navbar Link

**Files:**
- Modify: `apps/web/next.config.ts` (add `Referrer-Policy: no-referrer` & `X-Robots-Tag: noindex, nofollow` for `/hesap/:path*`)
- Modify: `apps/web/src/components/navbar.tsx` (add lightweight server-rendered link to `/hesap`)
- Create: `apps/web/src/app/(store)/hesap/layout.tsx` (`noindex`, `force-dynamic`, shared account nav)
- Create: `apps/web/src/app/(store)/hesap/page.tsx` (dashboard summary / redirect to `/hesap/giris`)
- Create: `apps/web/src/app/(store)/hesap/giris/page.tsx` + client form
- Create: `apps/web/src/app/(store)/hesap/kayit/page.tsx` + client form (separate KVKK notice & marketing checkboxes)
- Create: `apps/web/src/app/(store)/hesap/dogrula/page.tsx` + client confirm button (POST on click, never GET auto-consume)
- Create: `apps/web/src/app/(store)/hesap/sifre-sifirla/page.tsx` + client form (request & confirm views)
- Create: `apps/web/src/app/(store)/hesap/profil/page.tsx` + client form
- Create: `apps/web/src/app/(store)/hesap/adresler/page.tsx` + client CRUD + default toggle
- Create: `apps/web/src/app/(store)/hesap/siparisler/page.tsx`
- Create: `apps/web/src/app/(store)/hesap/siparisler/[id]/page.tsx`
- Create: `apps/web/src/app/(store)/hesap/sifre/page.tsx` + client form
- Create: `apps/web/src/app/(store)/hesap/sil/page.tsx` + client form (password + `"SİL"` confirmation)

- [ ] **Step 1: Add `/hesap` route protection headers in `next.config.ts` and implement all `/hesap/...` pages**
  - Every form input has explicit `<label htmlFor=...>`, `autoComplete`, and error banner with `role="alert"`.
  - All pages work via keyboard (Tab, Enter, Space).
- [ ] **Step 2: Run typecheck & build to verify segment isolation (public First Load JS unchanged)**
  - `pnpm --filter @alte/web typecheck && pnpm --filter @alte/web build`
- [ ] **Step 3: Commit**
  - `git commit -m "feat(web): add accessible /hesap customer account pages"`

---

### Task 9: Checkout Integration (`/odeme` & `/api/checkout`)

**Files:**
- Modify: `apps/web/src/app/(store)/odeme/page.tsx`
- Modify: `apps/web/src/components/checkout-form.tsx`
- Modify: `apps/web/src/app/api/checkout/route.ts`
- Modify: `apps/web/src/lib/medusa/cart.ts`

- [ ] **Step 1: Update `/odeme/page.tsx` & `checkout-form.tsx`**
  - If customer is logged in, pass `initialCustomer` (email locked, saved addresses with default preselected). Guest checkout remains identical when not logged in.
- [ ] **Step 2: Update `/api/checkout/route.ts`**
  - If customer session cookie is present and valid, fetch `/store/account/me` server-side and enforce `email = customer.email` (ignore client email), and ensure cart is associated with customer before completion.
- [ ] **Step 3: Run checkout unit tests & typecheck**
  - `pnpm --filter @alte/web test -- checkout && pnpm --filter @alte/web typecheck`
- [ ] **Step 4: Commit**
  - `git commit -m "feat(checkout): prefill saved addresses and enforce account email for logged-in customers"`

---

### Task 10: Live Verification (`verify-accounts.ts`), A11y/Keyboard Tests, Docs & Quality Baseline

**Files:**
- Create: `scripts/verify-accounts.ts`
- Modify: `scripts/verify-all.ts`
- Modify: `scripts/check-verify-scripts.ts`
- Modify: `package.json`
- Modify: `apps/web/src/tests/a11y-axe.test.ts`
- Modify: `apps/web/src/tests/keyboard-nav.test.ts`
- Modify: `docs/PERMISSIONS.md`
- Modify: `docs/SECURITY-DESIGN.md`
- Modify: `docs/RUNBOOK.md`
- Modify: `docs/PHASES.md`

- [ ] **Step 1: Create `scripts/verify-accounts.ts` covering all 14 live HTTP checks + log PII/password scan**
  - Add `"verify:accounts": "tsx scripts/verify-accounts.ts"` to `package.json` and register in `scripts/verify-all.ts`.
- [ ] **Step 2: Add `/hesap/giris` and `/hesap/kayit` to `a11y-axe.test.ts` and register/login/logout keyboard test to `keyboard-nav.test.ts`**
- [ ] **Step 3: Update `docs/PERMISSIONS.md`, `docs/SECURITY-DESIGN.md`, `docs/RUNBOOK.md`, `docs/PHASES.md`**
  - Include human-approval-required note on financial/order retention period in `docs/SECURITY-DESIGN.md` & `docs/RUNBOOK.md`.
- [ ] **Step 4: Run all checks locally (clean DB, `pnpm verify:all`, `REQUIRE_LIVE_SERVER=true` browser tests, `medusa start` + `next start` memory & First Load JS measurements, `format:check`, `lint`, `check:baseline`, `check:verify-scripts`, `typecheck`, `test`, `build`, `audit --prod --audit-level=high`, `gitleaks`)**
- [ ] **Step 5: Commit, push branch, open PR, and verify both GitHub Actions CI jobs (`security-and-quality` & `live-verify`) pass**
