# Security Audit Hardening (SEC-001 – SEC-015) Implementation Plan

> **For agentic workers:** Follow TDD (failing test first, then minimal fix, then verify) in strict priority order. Commit logically in conventional commit format on branch `fix/security-audit-2026-11`.

**Goal:** Remediate all 15 security findings (`SEC-001` through `SEC-015`) identified in the full-scale security audit, ordered by severity (CRITICAL -> HIGH -> MEDIUM -> LOW -> INFO/Hardening).

**Architecture:** Fixes span `apps/web` (signed order confirmation cookie, preview auth, Puck schema/renderer, Payload Users password policy & access, CSRF origin guard standardization, POST-based order tracking, BFF client IP forwarding) and `apps/medusa` (atomic JSONB order metadata updates with `FOR UPDATE`, `x-alte-client-ip` trusted BFF forwarding, register rollback, `req.auth_context.actor_id` audit logging, bounded caches/rate-limiters, SMTP DNS lookup SSRF check, PayTR fallback/test-connection cleanup, `email_log` skipped branch fix, atomic password-reset token consumption).

**Tech Stack:** TypeScript, Next.js 15, Payload CMS 3, Medusa v2, PostgreSQL, Vitest.

---

## Tasks (Priority Order)

### Task 1 (CRITICAL — SEC-001): Signed `_order_confirmation` Cookie, Safe `getOrder(orderId)`, and `/api/checkout/status` Cart Ownership Check

- **Files:**
  - Modify: `apps/web/src/lib/medusa/cookies.ts`
  - Modify: `apps/web/src/lib/medusa/cart.ts`
  - Modify: `apps/web/src/app/api/checkout/status/route.ts`
  - Test: `apps/web/src/tests/security-audit-p0.test.ts`
- **Behavior:**
  - `setOrderConfirmation(orderId)` signs `orderId` + expiration timestamp using HMAC-SHA256 with `INTERNAL_API_SECRET` (`<orderId>.<exp>.<mac>`).
  - `getOrderConfirmation()` validates format (`/^order_[A-Za-z0-9]{10,64}$/`), expiration, and HMAC via `crypto.timingSafeEqual`. Unsigned/tampered/expired cookies return `undefined`.
  - `getOrder(orderId)` validates `orderId` against `/^order_[A-Za-z0-9]{10,64}$/` and uses `encodeURIComponent(orderId)`.
  - `/api/checkout/status` verifies that the requested `cart_id` matches the caller's `cart_id` cookie (or a signed pending checkout cart cookie set during PayTR/iyzico initiation or callback) before setting `_order_confirmation` or returning `order_id`, while preserving PayTR/iyzico callback flows.

### Task 2 (HIGH — SEC-002): Remove `PAYLOAD_SECRET` Query Token from `/onizleme/[id]` and Enforce `safeParsePuckData`

- **Files:**
  - Modify: `apps/web/src/app/(store)/onizleme/[id]/page.tsx`
  - Test: `apps/web/src/tests/security-audit-p0.test.ts`
- **Behavior:**
  - Require authenticated Payload staff session (`isStaffRole(user.role)`) only; reject `?token=<PAYLOAD_SECRET>` with `notFound()`.
  - Parse `pageDoc.puckData` via `safeParsePuckData(pageDoc.puckData)` before passing to `<RenderPuckContent />`.

### Task 3 (HIGH — SEC-003): Atomic Order `metadata` Updates (`FOR UPDATE` + JSONB `||`)

- **Files:**
  - Modify: `apps/medusa/src/api/admin/order-operations/[id]/shipment/route.ts`
  - Modify: `apps/medusa/src/api/admin/order-operations/[id]/cancel/route.ts`
  - Modify: `apps/medusa/src/api/admin/order-operations/[id]/cod-captured/route.ts`
  - Modify: `apps/medusa/src/api/admin/order-operations/[id]/note/route.ts`
  - Modify: `apps/medusa/src/api/internal/payment/iyzico/callback/route.ts`
  - Test: `apps/medusa/src/api/admin/order-operations/order-metadata-atomic.test.ts`
- **Behavior:**
  - Wrap read-validate-write in `pgConnection.transaction` with `SELECT ... FOR UPDATE` and update using `COALESCE(metadata, '{}'::jsonb) || CAST(? AS jsonb)` (for `note`, append inside the locked transaction).
  - In `iyzico/callback/route.ts`, use atomic JSONB merge `COALESCE(metadata, '{}'::jsonb) || CAST(? AS jsonb)` instead of replacing the whole JSONB object.

### Task 4 (HIGH — SEC-004): Trusted Client IP Forwarding (`x-alte-client-ip`) & Non-Fatal 429 Handling in `/api/checkout/status`

- **Files:**
  - Modify: `apps/medusa/src/api/middleware-guards.ts`
  - Modify: `apps/web/src/lib/medusa/account.ts`
  - Modify: `apps/web/src/lib/medusa/products.ts`
  - Modify: `apps/web/src/app/api/checkout/status/route.ts`
  - Test: `apps/medusa/src/api/middleware-guards.test.ts`, `apps/web/src/tests/security-audit-p0.test.ts`
- **Behavior:**
  - `extractMedusaClientIp(req)` trusts `x-alte-client-ip` when `hasValidInternalSecret(req)` is true (validated via `net.isIP`).
  - Next.js BFF (`medusaAccountFetch`, `searchProducts`, `/api/checkout/status`) forwards `x-alte-client-ip` when client IP is known.
  - `/api/checkout/status` returns `status: "pending"` (not `"failed"`) on transient 429/5xx errors so paying customers on `/odeme/sonuc` are not falsely shown "Ödeme Tamamlanamadı".

### Task 5 (MEDIUM — SEC-005): Wrap `customerService.createCustomers` Inside Registration Rollback Block

- **Files:**
  - Modify: `apps/medusa/src/api/store/account/register/route.ts`
  - Test: `apps/medusa/src/api/store/account/account-transactions.test.ts`
- **Behavior:**
  - Move `customerService.createCustomers` inside the `try { ... } catch` rollback block so `authService.deleteAuthIdentities([authIdentityId])` always executes if customer creation fails.

### Task 6 (MEDIUM — SEC-006): Puck `bgImage` Validation & CSS Escaping + `ImageBlock` Render-Time `safeHref`

- **Files:**
  - Modify: `apps/web/src/lib/puck/schema.ts`
  - Modify: `apps/web/src/lib/puck/components.tsx`
  - Test: `apps/web/src/tests/puck-zod.test.ts`
- **Behavior:**
  - Extend `LINK_KEY_PATTERN` to match `image` suffix (`/(?:href|url|src|action|image)$|^link$/i`) and reject CSS injection characters (`"`, `'`, `(`, `)`, `\`, `\r`, `\n`) in `bgImage`.
  - Apply `safeHref` at render time in `HeroComponent` (`bgImage`) and `ImageBlockComponent` (`src`).

### Task 7 (MEDIUM — SEC-007): Fix Medusa Admin Actor Resolution (`req.auth_context.actor_id`) & Bounded Test Email Rate Limiter

- **Files:**
  - Modify: `apps/medusa/src/api/admin/payment-settings/route.ts`
  - Modify: `apps/medusa/src/api/admin/email-settings/route.ts`
  - Modify: `apps/medusa/src/api/admin/email-settings/test/route.ts`
  - Modify: `apps/medusa/src/api/admin/order-operations/[id]/note/route.ts`
  - Test: `apps/medusa/src/api/admin/email-settings/email-settings.test.ts`
- **Behavior:**
  - Resolve actor from `req.auth_context?.actor_id` instead of undefined `(req as any).user`.
  - Replace unbounded `testEmailRateLimitMap` with `SlidingWindowRateLimiter` (`maxEntries: 1000`).

### Task 8 (MEDIUM — SEC-008): Bound `inMemoryOrderPayloads`, `turkish-search` Rate Limiter, and `contact-service` Rate Limiter

- **Files:**
  - Modify: `apps/medusa/src/services/email-service.ts`
  - Modify: `apps/medusa/src/utils/turkish-search.ts`
  - Modify: `apps/web/src/lib/contact/contact-service.ts`
  - Test: `apps/medusa/src/utils/turkish-search.test.ts`, `apps/web/src/tests/contact-api.test.ts`
- **Behavior:**
  - Cap `inMemoryOrderPayloads` with TTL (15m) and `maxEntries = 200` (FIFO eviction).
  - Cap `turkish-search.ts` and `contact-service.ts` rate limit maps with `maxEntries` and expired-key pruning.

### Task 9 (MEDIUM — SEC-009): DNS Resolution Check in `validateSmtpHost` / `email-service.ts`

- **Files:**
  - Modify: `apps/medusa/src/utils/email-sanitizer.ts`
  - Modify: `apps/medusa/src/services/email-service.ts`
  - Test: `apps/medusa/src/utils/email-sanitizer.test.ts`
- **Behavior:**
  - Export `resolveAndValidateSmtpHost(host)` that resolves hostnames via `dns.promises.lookup(host, { all: true })` and rejects any resolved IP matching blocked metadata ranges (`169.254.0.0/16`, `100.64.0.0/10`, `fe80::/10`, etc.). Call it before creating Nodemailer transport in `email-service.ts`.

### Task 10 (MEDIUM — SEC-010): Payload `Users` Password Policy & Least-Privilege `canReadUsers`

- **Files:**
  - Modify: `apps/web/src/collections/Users.ts`
  - Test: `apps/web/src/tests/users-access.test.ts`
- **Behavior:**
  - Enforce `validateCustomerPassword` in `Users` `beforeChange` hook when `data.password` is set (throws `ValidationError` on weak passwords).
  - Restrict `canReadUsers` so non-admin staff can only read their own record (`{ id: { equals: user.id } }`).

### Task 11 (LOW — SEC-011): Standardize Fail-Closed `requireAccountOrigin` on `/api/admin/cache`, `/api/puck/save`, `/api/cart`, `/api/checkout`

- **Files:**
  - Modify: `apps/web/src/app/api/admin/cache/route.ts`
  - Modify: `apps/web/src/app/api/puck/save/route.ts`
  - Modify: `apps/web/src/app/api/cart/route.ts`
  - Modify: `apps/web/src/app/api/checkout/route.ts`
  - Update tests/verify scripts that send server-to-server requests to include `Origin` header (`apps/web/src/tests/cache-manager.test.ts`, `scripts/verify-content.ts`, `scripts/verify-checkout.ts`, `scripts/verify-cart-availability.ts`, `scripts/verify-storefront.ts`, `scripts/verify-security.ts`).

### Task 12 (LOW — SEC-012 & SEC-013): PayTR `user_ip` & `test-connection` Cleanup + `email_log` Skipped Branch Fix

- **Files:**
  - Modify: `apps/medusa/src/modules/payment-paytr/service.ts`
  - Modify: `apps/medusa/src/api/admin/payment-settings/test-connection/route.ts`
  - Modify: `apps/medusa/src/services/email-service.ts`

### Task 13 (LOW — SEC-014): POST-Based Order Tracking Form (`/siparis-takip`) & Render-Time `safeHref(tracking_url)`

- **Files:**
  - Create: `apps/web/src/app/api/order-tracking/route.ts`
  - Create: `apps/web/src/components/order-tracking-client.tsx`
  - Modify: `apps/web/src/app/(store)/siparis-takip/page.tsx`
  - Modify: `scripts/verify-journey.ts` (update to expect POST result without email in URL)

### Task 14 (INFO — SEC-015): Atomic Password-Reset Token Consumption

- **Files:**
  - Modify: `apps/medusa/src/modules/customer-account/service.ts`
  - Modify: `apps/medusa/src/api/store/account/password-reset/confirm/route.ts`
  - Test: `apps/medusa/src/modules/customer-account/service.test.ts`
- **Behavior:**
  - Consume password-reset token atomically (`UPDATE ... WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() RETURNING ...`) before updating password.

### Task 15 (Verification & PR):

- Run full verification suite (`pnpm format:check`, `pnpm lint`, `pnpm check:baseline`, `pnpm check:verify-scripts`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm audit --prod --audit-level=high`, `npx tsx scripts/check-gitleaks.ts`).
- Push `fix/security-audit-2026-11` and open a separate PR (`gh pr create`).
- Monitor GitHub Actions (`security-and-quality` + `live-verify`) until green.
