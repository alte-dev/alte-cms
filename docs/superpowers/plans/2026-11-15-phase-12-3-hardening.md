# Faz 12.3 Güvenlik Sertleştirme Paketi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 9 selected security hardening items (SEC-030, SEC-029, SEC-028, SEC-033, SEC-035, SEC-032, SEC-022 first half, SEC-027 modified, CI non-superuser) with TDD, live verification, and updated security/phase docs.

**Architecture:** Each hardening item is isolated to its route/guard/env/script module with unit tests written first (red -> green) and verified against live services via `pnpm verify:all` and GitHub CI (`security-and-quality` + `live-verify`).

**Tech Stack:** TypeScript, Medusa v2 (Express/Knex `pgConnection`), Next.js 15, Vitest, Zod, Gitleaks, GitHub Actions.

**Spec:** User request for Faz 12.3 (`phase-12-3-hardening` branch) + `AGENTS.md` + `docs/SECURITY-DESIGN.md`.

## Global Constraints

- Do NOT implement out-of-scope items (SEC-017, SEC-036, SEC-037, second half of SEC-022).
- Never commit real keys, passwords, emails, or domains (`example.test` and dummy values only).
- Pin dependencies strictly if any; do not add new dependencies.
- All new/modified behavior must have failing tests written first (TDD), then minimal implementation.
- Never merge the PR; human merges after review.

## Review Focus

- SEC-030 password reset: `authService.updateProvider` / `register` runs outside `pgConnection.transaction`; password update MUST succeed BEFORE token consumption and session revocation, so a failed password update never leaves a consumed token.
- SEC-028 strict guard: `/store/customers/me`, `/store/orders`, `/auth/session` must return 401 when Bearer token is missing, while admin JWTs (`actor_type !== "customer"`), guest checkout (`/store/carts`, `/store/payment-collections`), order tracking, and `/store/account/login|register` remain unaffected.
- SEC-029 rate limiting: 5 failed current-password attempts -> 429 + cooldown (without revoking session); second tier at 10 failures -> revoke all customer sessions.
- SEC-027 SSRF guard: reject ONLY link-local / cloud metadata ranges (`169.254.0.0/16`, `fe80::/10`, `100.64.0.0/10`) in production; allow `127.0.0.1` and RFC1918 private addresses.
- SEC-022 production guard script: tighten `||` checks to `res.code === 1 && output.includes("FAIL-CLOSED")` (or `env.ts` `[Security]` fail-closed check) and protect `finally` from mutating non-isolated/production DBs.

---

### Task 1: SEC-030 — Multi-step writes in transactions & ordered password reset

**Files:**

- Modify: `apps/medusa/src/api/store/account/_shared.ts` (`issueCustomerSession` optional `trxPg` param)
- Modify: `apps/medusa/src/api/store/account/delete/route.ts`
- Modify: `apps/medusa/src/api/store/account/password-reset/confirm/route.ts`
- Modify: `apps/medusa/src/api/store/account/password/route.ts`
- Test: `apps/medusa/src/api/store/account/account-transactions.test.ts`

- [ ] **Step 1: Write failing tests** for `delete`, `password-reset/confirm`, and `password` injecting errors mid-operation and asserting zero partial DB mutations (customer not half-anonymized, reset token not consumed if password update fails, session not revoked without new session or vice versa).
- [ ] **Step 2: Run test to verify it fails** (`pnpm --filter @alte/medusa test`).
- [ ] **Step 3: Implement minimal code**:
  - `account/delete/route.ts`: wrap anonymization, `customer_address` delete, guest anonymization, `provider_identity`/`auth_identity` delete, `revokeAllCustomerSessions(trx, customerId)`, and token/legacy cleanup in `pgConnection.transaction(async (trx) => { ... })`.
  - `password-reset/confirm/route.ts`: validate token row exists (unconsumed, unexpired) first without updating `used_at`; call `authService.updateProvider` / `register` (+ `updateAuthIdentities`); only on success run `pgConnection.transaction(async (trx) => { ... })` to atomically consume token, delete legacy credentials, invalidate other tokens, and revoke sessions.
  - `password/route.ts`: after `authService.authenticate` and `authService.updateProvider` succeed, run `revokeAllCustomerSessions(trx, customerId)` and `issueCustomerSession(req, customerId, authIdentityId, trx)` inside `pgConnection.transaction(async (trx) => { ... })`.
- [ ] **Step 4: Run tests to verify pass** and commit.

---

### Task 2: SEC-029 — Password-verification rate limiting on `/store/account/password` & `/store/account/delete`

**Files:**

- Modify: `apps/medusa/src/api/store/account/_shared.ts`
- Modify: `apps/medusa/src/api/store/account/password/route.ts`
- Modify: `apps/medusa/src/api/store/account/delete/route.ts`
- Test: `apps/medusa/src/api/store/account/password-rate-limit.test.ts`

- [ ] **Step 1: Write failing tests** for per-`customerId` wrong-password tracking: 5 failures -> `429` + cooldown (session NOT revoked), 10 failures -> session revoked (`revokeAllCustomerSessions`), and valid password accepted when under limit.
- [ ] **Step 2: Run test to verify it fails**.
- [ ] **Step 3: Implement minimal code** using `BruteForceGuard` (tier 1: 5 failures -> 429; tier 2: 10 failures -> revoke sessions) and reset on success.
- [ ] **Step 4: Run tests to verify pass** and commit.

---

### Task 3: SEC-028 — Strict customer session guard on `/store/customers/me`, `/store/orders`, `/auth/session`

**Files:**

- Modify: `apps/medusa/src/api/middleware-guards.ts` (add `strictCustomerSessionGuard`)
- Modify: `apps/medusa/src/api/middlewares.ts` (use `strictCustomerSessionGuard` on `/store/customers/me`, `/store/orders`, `/auth/session`)
- Test: `apps/medusa/src/api/middleware-guards.test.ts`

- [ ] **Step 1: Write failing tests** verifying `strictCustomerSessionGuard` returns `401` when no Bearer token is present, allows admin JWTs (`actor_type !== "customer"`), and rejects revoked/invalid customer JWTs.
- [ ] **Step 2: Run test to verify it fails**.
- [ ] **Step 3: Implement `strictCustomerSessionGuard`** and wire it in `middlewares.ts` ONLY on `/store/customers/me`, `/store/orders`, `/auth/session`.
- [ ] **Step 4: Run tests to verify pass** and commit.

---

### Task 4: SEC-033 & SEC-035 — Error message sanitization, checkout tolerance, CORS production guard, manual-refunds 500

**Files:**

- Modify: `apps/web/src/lib/medusa/format.ts` (`mapMedusaError` final fallback)
- Test: `apps/web/src/lib/medusa/format.test.ts`
- Modify: `scripts/verify-checkout.ts` (~line 855: `<= 100` -> `<= 0.01`)
- Modify: `apps/medusa/src/env.ts` (reject `*` in `ADMIN_CORS`, `AUTH_CORS`, `STORE_CORS` in production)
- Test: `apps/medusa/src/env.test.ts`
- Modify: `apps/medusa/src/api/admin/payment-settings/manual-refunds/route.ts` (return `500` on DB error)
- Test: `apps/medusa/src/api/admin/payment-settings/manual-refunds/route.test.ts`

- [ ] **Step 1: Write failing unit tests** for `mapMedusaError` (raw Medusa message not leaked, returns fixed Turkish generic message, logs error without PII), `env.ts` (production rejects `*` in `ADMIN_CORS`, `AUTH_CORS`, `STORE_CORS`), and `manual-refunds` (returns `500` on DB error).
- [ ] **Step 2: Run tests to verify failure**.
- [ ] **Step 3: Implement changes** in `format.ts`, `verify-checkout.ts`, `env.ts`, and `manual-refunds/route.ts`.
- [ ] **Step 4: Run tests to verify pass** and commit.

---

### Task 5: SEC-032 & SEC-022 (first half) — Remove script secret fallbacks, scope `.gitleaks.toml`, tighten `verify-production-guard.ts`

**Files:**

- Modify: `scripts/verify-quality.ts`
- Modify: `scripts/measure-quality.ts`
- Modify: `.gitleaks.toml`
- Modify: `scripts/verify-production-guard.ts`

- [ ] **Step 1: Update `verify-quality.ts` and `measure-quality.ts`** to remove hardcoded `pk_...` and `dev-payload-super-secret-key-...` fallbacks; resolve `MEDUSA_KEY` from env or Medusa admin API (like `verify-checkout.ts`), and require `PAYLOAD_SECRET` from env when needed with a clear error.
- [ ] **Step 2: Update `.gitleaks.toml`** to remove global `example\.com` regex and scope it to specific test fixture/test paths if needed.
- [ ] **Step 3: Tighten `scripts/verify-production-guard.ts`** `||` checks to `res.code === 1 && output.includes("FAIL-CLOSED")` (for guard scenarios) and add a local-DB safety check in `finally` (refuse destructive restore unless `DATABASE_URL` points to local/test DB `127.0.0.1` / `localhost` and `medusa_db` / `test`).
- [ ] **Step 4: Commit**.

---

### Task 6: SEC-027 (modified) — SMTP hostname validation, link-local/metadata SSRF block, HTML escaping

**Files:**

- Modify: `apps/medusa/src/utils/email-sanitizer.ts` (add `isBlockedSmtpMetadataHost` for `169.254.0.0/16`, `fe80::/10`, `100.64.0.0/10` + IPv4/IPv6 literal support in `isValidHostname` if needed for RFC1918)
- Test: `apps/medusa/src/utils/email-sanitizer.test.ts`
- Modify: `apps/medusa/src/api/admin/email-settings/route.ts`
- Modify: `apps/medusa/src/api/admin/email-settings/test/route.ts`
- Test: `apps/medusa/src/api/admin/email-settings/email-settings.test.ts`

- [ ] **Step 1: Write failing tests** for `smtp.example.test`, `127.0.0.1`, `192.168.1.10` (accepted), `169.254.169.254`, `fe80::1`, `100.64.0.1` (rejected in production), invalid hostnames (rejected), and `escapeHtml(settings.host)` in test email HTML body.
- [ ] **Step 2: Run tests to verify failure**.
- [ ] **Step 3: Implement** validation in `email-sanitizer.ts`, `email-settings/route.ts`, and `email-settings/test/route.ts`.
- [ ] **Step 4: Run tests to verify pass** and commit.

---

### Task 7: CI non-superuser `medusa_user` & Documentation & Full Verification

**Files:**

- Modify: `.github/workflows/ci.yml` (remove `SUPERUSER` from `medusa_user`)
- Modify: `docs/SECURITY-DESIGN.md` (document SEC-027 metadata-only block rationale and SEC-029 two-tier thresholds)
- Modify: `docs/PHASES.md` (add Faz 12.3 and list deferred items SEC-017, SEC-022 second half, SEC-036, SEC-037 with reasons)

- [ ] **Step 1: Update `.github/workflows/ci.yml`**, `docs/SECURITY-DESIGN.md`, and `docs/PHASES.md`.
- [ ] **Step 2: Run full local checks**: `pnpm format:check`, `pnpm lint`, `pnpm check:baseline`, `pnpm check:verify-scripts`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit --prod --audit-level=high`, `gitleaks`, and `pnpm verify:all`.
- [ ] **Step 3: Push `phase-12-3-hardening` and open PR** (do NOT merge). Verify both `security-and-quality` and `live-verify` CI jobs pass green.
