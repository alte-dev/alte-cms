# Faz 12.4 — Güvenlik Denetimi Bulgularının Kapatılması Planı

**Dal:** `phase-12-4-security-fixes` (worktree: `../CMS-phase-12-4-security-fixes`)
**Hedef:** Bağımsız güvenlik denetimi bulgularının (1–7) TDD + canlı HTTP doğrulamasıyla kapatılması.

## Uygulama Sırası ve Adımlar

### 1. Medusa Admin Girişi Hız Sınırı (`/auth/user/emailpass`)

- **Dosyalar:** `apps/medusa/src/api/middlewares.ts`, `apps/medusa/src/api/middleware-guards.ts`, `apps/medusa/src/api/admin/auth-rate-limit.test.ts` (yeni)
- **Tasarım:**
  - `extractClientIp` (`TRUST_PROXY` / `TRUSTED_PROXY_HOPS` fail-closed kalıbı, Node `IncomingMessage` / `MedusaRequest` uyumlu) ekle.
  - `BruteForceGuard` ile iki kademeli kilit (yalnızca **hatalı** denemeler sayılır; başarılı girişte yalnızca kendi `ip:hmac(email)` sayacı sıfırlanır):
    - IP + e-posta: 5 hata / 15 dk (`adminLoginIpEmailGuard`)
    - E-posta (IP'den bağımsız): 15 hata / 15 dk (`adminLoginEmailGuard`)
  - Middleware `POST /auth/user/emailpass` üzerinde çalışır; `res.on("finish")` (veya `res.end` sarımı) ile 2xx dışındaki (401/403) yanıtları hata sayar, 2xx yanıtında `ip:hmac(email)` sayacını sıfırlar.
  - Başarılı girişler hiçbir zaman 429'a takılmaz (mevcut `getAdminToken` bozulmaz).
- **TDD:** Önce başarısız birim/middleware testi yaz → geçir.

### 2. `/medusa-api/*` Allowlist Daraltması (`apps/web/next.config.ts`)

- **Araştırma:** Gerçek tarayıcı (Playwright) ile `/app` üzerinden giriş, ürün listesi, ürün kaydetme, sipariş listesi ağ isteklerini kaydet; hangi `/medusa-api/*` yollarının gerçekten kullanıldığını çıkar.
- **Tasarım:** `apps/web/next.config.ts` içinde `/medusa-api/:path*` wildcard rewrite'ını kaldırıp yalnızca allowlist yollarını (`admin/:path*`, `auth/user/:path*`, `auth/session`, `auth/token/refresh`) rewrite et. `/medusa-api/store/*`, `/medusa-api/hooks/*`, `/medusa-api/internal/*`, `/medusa-api/auth/customer/*` otomatik olarak Next.js 404 döner.

### 3. Sipariş Takibi Hız Sınırı ve Gizli Anahtar (`store/order-tracking/route.ts`)

- **Dosyalar:** `apps/medusa/src/api/middlewares.ts`, `apps/medusa/src/api/store/order-tracking/route.ts`, `apps/web/src/app/(store)/siparis-takip/page.tsx`, `apps/medusa/src/api/store/order-tracking/route.test.ts` (yeni)
- **Tasarım:**
  - `/store/order-tracking` rotasına `requireInternalSecret` middleware'i ekle.
  - `store/order-tracking/route.ts` içinden `req.ip || x-forwarded-for` okumasını kaldır; `getTrustedClientIp(req)` (`x-alte-client-ip`, yoksa `"unknown"`) kullan.
  - Sipariş numarası başına IP'den bağımsız `BruteForceGuard` (20 hata / 15 dk) ekle (`trackingOrderGuard`).
  - `apps/web/src/app/(store)/siparis-takip/page.tsx`: `headers()` + `extractClientIp` ile istemci IP'sini çıkarıp `x-alte-internal` ve `x-alte-client-ip` başlıklarıyla Medusa'ya ilet.
- **TDD:** Önce başarısız birim testi yaz → geçir.

### 4. Admin Rol Koruması (Fail-Closed + Migration + SSO)

- **Dosyalar:** `apps/medusa/src/utils/admin-role-guard.ts`, `apps/medusa/src/utils/admin-role-guard.test.ts` (yeni), `apps/medusa/src/api/internal/admin-sso/route.ts`, `apps/web/src/lib/auth/admin-sso.ts`, `apps/web/src/app/api/admin/switch-to-medusa/route.ts`, `apps/medusa/src/api/admin/order-operations/**`, `apps/medusa/src/api/admin/payment-settings/test-connection/route.ts`, `apps/medusa/src/api/admin/payment-settings/manual-refunds/route.ts`, `apps/medusa/src/scripts/setup-store.ts` (veya idempotent Medusa user role migration/adımı)
- **Tasarım:**
  - `resolveAdminRole`: `role || "admin"` kaldırılır; rol yoksa veya tanınmazsa `{ ok: false }` + 403 fail-closed.
  - `admin/order-operations/*` (5 dosya): `checkAdminOrShopManagerRole` ekle.
  - `admin/payment-settings/test-connection` ve `manual-refunds`: `checkAdminSettingsRole` ekle.
  - `internal/admin-sso/route.ts`: Payload'dan gelen `role` (`admin` / `super-admin`) doğrulanıp `user.metadata.role` olarak yazılsın/güncellensin.
  - İdempotent `ensureAdminRoles` adımı (`setup-store.ts` + bağımsız migration/script): `metadata->>'role'` boş olan mevcut `user` kayıtlarına bir kez `super-admin` atar; ikinci kez çalıştırıldığında sorunsuz ve var olan rolleri ezmez.
- **TDD:** Önce başarısız birim testi yaz → geçir.

### 5. CSP, HSTS ve Permissions-Policy (`apps/web/next.config.ts`)

- **Dosyalar:** `apps/web/next.config.ts`, `apps/web/src/lib/security/headers.ts` (yeni, test edilebilir)
- **Tasarım:**
  - Statik başlıklar (nonce'suz — Next 15 ISR/statik önbellek ve bellek bütçesini korumak için):
    - Storefront: `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; script-src 'self' 'unsafe-inline' https://www.paytr.com ...; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; frame-src 'self' https://www.paytr.com; connect-src 'self' https://www.paytr.com [dev: http://localhost:* http://127.0.0.1:* ws: wss:]; form-action 'self' https://www.paytr.com;` (`NODE_ENV === "production"` iken `unsafe-eval`, `localhost`, `127.0.0.1`, `ws:`, `wss:` kesinlikle çıkarılır).
    - `/admin/:path*` ve `/app/:path*`: Payload/Medusa Admin uyumlu ama yine `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'` içeren CSP.
    - Üretimde `Strict-Transport-Security: max-age=31536000; includeSubDomains` (preload yok).
    - Tüm yollarda `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **TDD:** `headers.test.ts` içinde prod/dev CSP ve güvenlik başlıklarını test et.

### 6. Payload Giriş Hız Sınırı & Kilitli Hesap Maskelemesi

- **Dosyalar:** `apps/web/src/middleware.ts` (yeni), `apps/web/src/collections/Users.ts` (veya `afterError` hook), `apps/web/src/tests/middleware-rate-limit.test.ts` (yeni)
- **Tasarım:**
  - Next.js 15.5.29'da Node.js runtime (`experimental: { nodeMiddleware: true }` / `runtime: "nodejs"` — `next/dist/docs` veya gerçek `next start` altında test edilecek; Edge isolate sorunu olmaması için Node runtime doğrulanacak).
  - Yalnızca `POST /api/users/login` için IP başına hız sınırı (ör. 10 istek / 15 dk; `GET /admin/login` sınırlanmaz). Aşıldığında 429 + `Retry-After`.
  - Payload `Users` koleksiyonunda `afterError` hook ile `"This user is locked..."` mesajını genel hata mesajıyla (`"The email or password provided is incorrect."`) değiştirerek e-posta numaralandırmayı kapat.
- **TDD:** Birim testi + `next start` altında canlı HTTP testi.

### 7. Düşük Öncelikli Düzeltmeler

1. `store/checkout-status/route.ts`: 500'de sabit Türkçe hata mesajı + PII'siz log, bulunamayan sepet için 404, geçersiz `cart_id` için 400; filtresiz `query.graph` / `listOrders({})` dallarını kaldır (yalnızca `filters: { cart_id: cartId }` veya `cart.metadata.order_id`).
2. `hooks/payment/pp_paytr_paytr/route.ts`: `status === "success"` iken `!(expectedKurus > 0)` ise siparişi tamamlama, oturumu `needs_manual_review: true` olarak güncelle, PII'siz logla, PayTR'ye `200 OK` dön. Birim test ekle.
3. `/api/search/suggestions` ve `/store/search`: `/api/search/suggestions` için Next middleware veya route içinde `extractClientIp` ile 60/dk hız sınırı; `/store/search` için web katmanından `x-alte-internal` + `x-alte-client-ip` iletilmesi veya `getTrustedClientIp` kullanımı (live testle doğrula).
4. `docs/RUNBOOK.md`: `INTERNAL_API_SECRET` döndürme adımları + grep/test ile sızıntı olmadığı doğrulaması.

### 8. Canlı Doğrulama (`scripts/verify-security.ts`), Dokümantasyon ve CI

- `scripts/verify-security.ts` yaz, `package.json` (`verify:security`), `scripts/verify-all.ts` ve `.github/workflows/ci.yml` (`live-verify`) içine ekle.
- `docs/SECURITY-DESIGN.md`, `docs/RUNBOOK.md`, `docs/PHASES.md` güncelle.
- Temiz DB'de `VERIFY_ALLOW_DB_MUTATION=true pnpm verify:all`, tüm statik/kalite/audit/gitleaks kontrolleri, PR açılışı ve GitHub CI doğrulaması.
