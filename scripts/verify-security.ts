/**
 * scripts/verify-security.ts
 *
 * FAZ 12.4 — Live Security Audit Verification Suite (`pnpm verify:security`)
 *
 * Verifies against running Medusa (:9000) & Next.js (:3100):
 *  1. Medusa Admin Login Rate Limit (/auth/user/emailpass) + header spoof resistance
 *  2. /medusa-api/* allowlist (404 on /store, /hooks, /internal, /auth/customer) + live /app browser flow
 *  3. /store/order-tracking internal secret + header spoof resistance + per-order limit
 *  4. Admin Role Guard fail-closed (role-less -> 403, editor -> 403, shop-manager -> ops only, super-admin -> 200)
 *  5. CSP, Permissions-Policy, and HSTS headers (no unsafe-eval/localhost/ws: in production)
 *  6. Payload login rate limit (POST /api/users/login -> 429, GET /admin/login -> 200) + locked message masking
 *  7. Low-severity fixes: checkout-status (400/404/no raw error), search rate limits (429)
 */

import crypto from "crypto";
import http from "http";
import https from "https";
import pg from "pg";
import { setAdminUserRole } from "./admin-set-role";
import { createStepRecorder, launchVerifyBrowser } from "./lib/verify-step";

const MEDUSA_URL = (
  process.env.MEDUSA_BACKEND_URL ||
  process.env.TEST_MEDUSA_URL ||
  "http://127.0.0.1:9000"
).replace(/\/+$/, "");

const WEB_URL = (
  process.env.WEB_URL ||
  process.env.TEST_WEB_URL ||
  "http://localhost:3100"
).replace(/\/+$/, "");

const ADMIN_EMAIL = process.env.MEDUSA_ADMIN_EMAIL || "admin@example.test";
const ADMIN_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD || "supersecret-test-password";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || "";
const PUBLISHABLE_KEY =
  process.env.MEDUSA_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

function rawHttpStatus(baseUrl: string, method: string, rawPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(baseUrl);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: rawPath,
        method,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function signAdminJwt(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      actor_id: userId,
      actor_type: "user",
      auth_identity_id: "",
      app_metadata: { user_id: userId },
      iat: now,
      exp: now + 300,
    }),
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${sig}`;
}

async function run() {
  const { recordStep, results } = createStepRecorder({ format: "adim" });

  // 1. Medusa Admin Login Rate Limit (POST /auth/user/emailpass)
  const testEmail = `sec-admin-${Date.now()}@example.test`;
  const adminStatuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": `192.0.2.${i + 1}`,
        "X-Real-IP": `192.0.2.${i + 100}`,
      },
      body: JSON.stringify({ email: testEmail, password: "wrong-password-123" }),
    });
    adminStatuses.push(r.status);
  }
  const validAdminRes = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const validAdminJson = (await validAdminRes.json().catch(() => ({}))) as { token?: string };
  const adminToken = validAdminJson.token || "";

  const step1Pass =
    adminStatuses.slice(0, 5).every((s) => s === 401) &&
    adminStatuses[5] === 429 &&
    validAdminRes.status === 200 &&
    Boolean(adminToken);
  recordStep(
    1,
    "Medusa Admin Login Rate Limit (5 fails -> 429, spoofed headers ignored, valid admin 200)",
    step1Pass,
    `Statuses: [${adminStatuses.join(", ")}], Valid admin login: HTTP ${validAdminRes.status}`,
  );

  // 2a. /medusa-api/* Allowlist & Path Traversal Guard (blocked routes must return 404)
  const blockedProbes: Array<{ method: string; path: string }> = [
    { method: "GET", path: "/medusa-api/store/products" },
    { method: "GET", path: "/medusa-api/hooks/payment/pp_paytr_paytr" },
    { method: "GET", path: "/medusa-api/internal/admin-sso" },
    { method: "GET", path: "/medusa-api/auth/customer/emailpass" },
    { method: "GET", path: "/medusa-api/admin/%2e%2e/store/products?limit=1" },
    { method: "GET", path: "/medusa-api/auth/user/%2e%2e/%2e%2e/store/products" },
    { method: "POST", path: "/medusa-api/admin/%2e%2e/store/carts" },
    { method: "POST", path: "/medusa-api/admin/%2e%2e/hooks/payment/pp_paytr_paytr" },
    { method: "GET", path: "/medusa-api/admin/%2E%2E/store/products" },
    { method: "GET", path: "/medusa-api/admin/..%2fstore/products" },
    { method: "GET", path: "/medusa-api/admin/%252e%252e/store/products" },
    { method: "GET", path: "/medusa-api/admin/./../store/products" },
    { method: "GET", path: "/medusa-api/admin//..//store/products" },
    { method: "GET", path: "/medusa-api/admin/products;foo=bar" },
    { method: "GET", path: "/medusa-api/admin/..\\store/products" },
  ];
  const blockedResults: Array<{ path: string; status: number }> = [];
  for (const probe of blockedProbes) {
    const status = await rawHttpStatus(WEB_URL, probe.method, probe.path);
    blockedResults.push({ path: `${probe.method} ${probe.path}`, status });
  }
  const step2aPass = blockedResults.every((item) => item.status === 404);
  recordStep(
    2,
    "/medusa-api/* Allowlist & Path Traversal Guard Returns 404",
    step2aPass,
    blockedResults.map((b) => `${b.path}->${b.status}`).join(", "),
  );

  // 2b. Live Browser Flow on /app (Admin login, products list, orders list)
  let browserOk = false;
  let browserDetail = "";
  const seenMedusaApiPaths = new Set<string>();
  const failedMedusaApiCalls: string[] = [];

  const browser = await launchVerifyBrowser();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        pageErrors.push(msg.text());
      }
    });
    page.on("response", (res) => {
      try {
        const u = new URL(res.url());
        if (u.pathname.startsWith("/medusa-api/")) {
          seenMedusaApiPaths.add(`${res.request().method()} ${u.pathname} (${res.status()})`);
          // Medusa Admin probes /cloud/auth which returns 404 outside Medusa Cloud
          if (u.pathname === "/medusa-api/cloud/auth") {
            return;
          }
          if (res.status() === 404 || res.status() >= 500) {
            failedMedusaApiCalls.push(`${res.request().method()} ${u.pathname}->${res.status()}`);
          }
        }
      } catch {
        // ignore invalid URLs
      }
    });

    try {
      await page.goto(`${WEB_URL}/app/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
      const emailInput = page.locator('input[name="email"], input[type="email"]').first();
      await emailInput.waitFor({ state: "visible", timeout: 30000 });
      await emailInput.fill(ADMIN_EMAIL);
      const passInput = page.locator('input[name="password"], input[type="password"]').first();
      await passInput.fill(ADMIN_PASSWORD);
      await Promise.all([
        page.waitForURL(/\/app(\/orders|\/products)?$/, { timeout: 20000 }).catch(() => {}),
        page.click('button[type="submit"]'),
      ]);
      await page.waitForTimeout(2000);

      await page.goto(`${WEB_URL}/app/products`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(1000);
      await page.goto(`${WEB_URL}/app/orders`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(1000);

      browserOk =
        seenMedusaApiPaths.size > 0 &&
        failedMedusaApiCalls.length === 0 &&
        !page.url().includes("/login");
      browserDetail = `Captured ${seenMedusaApiPaths.size} /medusa-api calls [${Array.from(seenMedusaApiPaths).slice(0, 8).join("; ")}]; errors=${failedMedusaApiCalls.length} [${failedMedusaApiCalls.join(", ")}]; pageErrors=${pageErrors.length} [${pageErrors.slice(0, 3).join(" | ")}]`;
    } catch (err: any) {
      browserOk = false;
      browserDetail = `Browser error: ${err?.message || err}; url=${page.url()}; seen=${seenMedusaApiPaths.size}; pageErrors=[${pageErrors.slice(0, 5).join(" | ")}]`;
    }
  } finally {
    await browser.close();
  }
  recordStep(
    3,
    "Medusa Admin (/app) Live Browser Flow Works Through Allowlist",
    browserOk,
    browserDetail,
  );

  // 3. Order Tracking: Internal Secret + Spoofed XFF + Per-Order Limit
  const pubKeyHeader: Record<string, string> = PUBLISHABLE_KEY
    ? { "x-publishable-api-key": PUBLISHABLE_KEY }
    : {};
  const unauthTrack = await fetch(`${MEDUSA_URL}/store/order-tracking`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...pubKeyHeader },
    body: JSON.stringify({ order_id_or_number: "#1001", email: "test@example.test" }),
  });

  const orderKey = `ORDSEC${Date.now()}`;
  const trackingStatuses: number[] = [];
  for (let i = 0; i < 21; i++) {
    const r = await fetch(`${MEDUSA_URL}/store/order-tracking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...pubKeyHeader,
        "x-alte-internal": INTERNAL_SECRET,
        "x-alte-client-ip": `198.51.100.${i + 10}`,
        "x-forwarded-for": `192.0.2.${i + 10}`,
      },
      body: JSON.stringify({
        order_id_or_number: orderKey,
        email: `guess${i}@example.test`,
      }),
    });
    trackingStatuses.push(r.status);
  }
  const otherOrderRes = await fetch(`${MEDUSA_URL}/store/order-tracking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...pubKeyHeader,
      "x-alte-internal": INTERNAL_SECRET,
      "x-alte-client-ip": "203.0.113.99",
    },
    body: JSON.stringify({
      order_id_or_number: `${orderKey}OTHER`,
      email: "other@example.test",
    }),
  });

  const step4Pass =
    unauthTrack.status === 404 &&
    trackingStatuses.slice(0, 20).every((s) => s === 404) &&
    trackingStatuses[20] === 429 &&
    otherOrderRes.status === 404;
  recordStep(
    4,
    "Order Tracking Requires Internal Secret & Enforces Per-Order Limit Across IPs",
    step4Pass,
    `No-secret=${unauthTrack.status}, 21 attempts=[${trackingStatuses.join(",")}], other-order=${otherOrderRes.status}`,
  );

  // 4. Admin Role Guard (Fail-Closed): role-less -> 403, editor -> 403, shop-manager -> ops 200 / settings 403, super-admin -> 200
  let roleGuardPass = false;
  let roleGuardDetail = "";
  if (DATABASE_URL && JWT_SECRET) {
    const pool = new pg.Pool({ connectionString: DATABASE_URL });
    const tempIds: string[] = [];
    try {
      const insertTempUser = async (
        id: string,
        email: string,
        metadata: Record<string, unknown> | null,
      ) => {
        tempIds.push(id);
        await pool.query(
          `INSERT INTO "user" (id, email, metadata, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())`,
          [id, email, metadata ? JSON.stringify(metadata) : null],
        );
      };

      const suffix = Date.now();
      const rolelessId = `usr_sec_none_${suffix}`;
      const rolelessEmail = `none-${suffix}@example.test`;
      const editorId = `usr_sec_ed_${suffix}`;
      const shopId = `usr_sec_sm_${suffix}`;

      await insertTempUser(rolelessId, rolelessEmail, null);
      await insertTempUser(editorId, `editor-${suffix}@example.test`, { role: "editor" });
      await insertTempUser(shopId, `shop-${suffix}@example.test`, { role: "shop-manager" });

      const storeRes = await pool.query(
        `SELECT metadata FROM "store" WHERE deleted_at IS NULL LIMIT 1`,
      );
      const backfillDone = storeRes.rows[0]?.metadata?.role_backfill_done === true;

      const rolelessRes = await fetch(`${MEDUSA_URL}/admin/payment-settings/manual-refunds`, {
        headers: { Authorization: `Bearer ${signAdminJwt(rolelessId)}` },
      });
      // Promote roleless user via admin:set-role helper and verify access
      await setAdminUserRole(pool, rolelessEmail, "shop-manager");
      const promotedOpsRes = await fetch(`${MEDUSA_URL}/admin/order-operations/export-csv`, {
        headers: { Authorization: `Bearer ${signAdminJwt(rolelessId)}` },
      });
      const promotedSetRes = await fetch(`${MEDUSA_URL}/admin/payment-settings/manual-refunds`, {
        headers: { Authorization: `Bearer ${signAdminJwt(rolelessId)}` },
      });

      const editorOpsRes = await fetch(`${MEDUSA_URL}/admin/order-operations/export-csv`, {
        headers: { Authorization: `Bearer ${signAdminJwt(editorId)}` },
      });
      const shopOpsRes = await fetch(`${MEDUSA_URL}/admin/order-operations/export-csv`, {
        headers: { Authorization: `Bearer ${signAdminJwt(shopId)}` },
      });
      const shopSetRes = await fetch(`${MEDUSA_URL}/admin/payment-settings/manual-refunds`, {
        headers: { Authorization: `Bearer ${signAdminJwt(shopId)}` },
      });
      const adminSetRes = await fetch(`${MEDUSA_URL}/admin/payment-settings/manual-refunds`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      roleGuardPass =
        backfillDone &&
        rolelessRes.status === 403 &&
        promotedOpsRes.status === 200 &&
        promotedSetRes.status === 403 &&
        editorOpsRes.status === 403 &&
        shopOpsRes.status === 200 &&
        shopSetRes.status === 403 &&
        adminSetRes.status === 200;
      roleGuardDetail = `backfillDone=${backfillDone}, roleless=${rolelessRes.status}, promoted-ops=${promotedOpsRes.status}, promoted-set=${promotedSetRes.status}, editor-ops=${editorOpsRes.status}, shop-ops=${shopOpsRes.status}, shop-settings=${shopSetRes.status}, super-admin-settings=${adminSetRes.status}`;
    } finally {
      if (tempIds.length > 0) {
        await pool
          .query(`DELETE FROM "user" WHERE id = ANY($1::text[])`, [tempIds])
          .catch(() => {});
      }
      await pool.end();
    }
  } else {
    roleGuardDetail = "DATABASE_URL or JWT_SECRET missing";
  }
  recordStep(5, "Admin Role Guard Fail-Closed Matrix (Live HTTP)", roleGuardPass, roleGuardDetail);

  // 5. Security Headers & CSP (Storefront + /admin + /app)
  const homeRes = await fetch(`${WEB_URL}/`);
  const appRes = await fetch(`${WEB_URL}/app/login`);
  const adminRes = await fetch(`${WEB_URL}/admin/login`);
  const csp = homeRes.headers.get("content-security-policy") || "";
  const appCsp = appRes.headers.get("content-security-policy") || "";
  const adminCsp = adminRes.headers.get("content-security-policy") || "";
  const perm = homeRes.headers.get("permissions-policy") || "";
  const hsts = homeRes.headers.get("strict-transport-security") || "";

  const isProdServer = Boolean(hsts) || !csp.includes("'unsafe-eval'");
  const hasStrictCsp =
    csp.includes("default-src 'self'") &&
    csp.includes("object-src 'none'") &&
    csp.includes("base-uri 'self'") &&
    csp.includes("frame-ancestors 'self'") &&
    csp.includes("form-action 'self' https://www.paytr.com") &&
    csp.includes("frame-src 'self' https://www.paytr.com");
  const hasAppAndAdminCsp =
    appCsp.includes("default-src 'self'") &&
    appCsp.includes("object-src 'none'") &&
    adminCsp.includes("default-src 'self'") &&
    adminCsp.includes("object-src 'none'");
  const hasPerm =
    perm.includes("camera=()") && perm.includes("microphone=()") && perm.includes("geolocation=()");
  const prodClean =
    !isProdServer ||
    (!csp.includes("'unsafe-eval'") &&
      !csp.includes("localhost") &&
      !csp.includes("127.0.0.1") &&
      !csp.includes("ws:") &&
      hsts === "max-age=31536000; includeSubDomains");

  recordStep(
    6,
    "CSP (Storefront, /admin, /app), Permissions-Policy & HSTS Headers Verified",
    hasStrictCsp && hasAppAndAdminCsp && hasPerm && prodClean,
    `hasStrictCsp=${hasStrictCsp}, hasAppAndAdminCsp=${hasAppAndAdminCsp}, hasPerm=${hasPerm}, prodClean=${prodClean}, hsts="${hsts}"`,
  );

  // 6. Payload Login Rate Limit & Locked Account Masking
  const adminLoginGet = await fetch(`${WEB_URL}/admin/login`);
  const payloadLoginStatuses: number[] = [];
  const payloadBodies: string[] = [];
  for (let i = 0; i < 11; i++) {
    const r = await fetch(`${WEB_URL}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `nonexistent-sec-${Date.now()}@example.test`,
        password: "wrong-password-123",
      }),
    });
    payloadLoginStatuses.push(r.status);
    if (i === 0 || i === 10) {
      payloadBodies.push(await r.text());
    }
  }
  const forgotRes = await fetch(`${WEB_URL}/api/users/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `nonexistent-fp-${Date.now()}@example.test` }),
  });
  const resetRes = await fetch(`${WEB_URL}/api/users/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "invalid", password: "NewPassword123!" }),
  });

  const step7Pass =
    adminLoginGet.status === 200 &&
    payloadLoginStatuses.some((s) => s === 401 || s === 400) &&
    payloadLoginStatuses[payloadLoginStatuses.length - 1] === 429 &&
    forgotRes.status === 429 &&
    resetRes.status === 429 &&
    !payloadBodies[0].toLowerCase().includes("locked");
  recordStep(
    7,
    "Payload Auth Rate Limit (login/forgot-password/reset-password -> 429, GET /admin/login -> 200)",
    step7Pass,
    `GET /admin/login=${adminLoginGet.status}, POST login=[${payloadLoginStatuses.join(", ")}], forgot=${forgotRes.status}, reset=${resetRes.status}`,
  );

  // 7. Low-Severity Fixes: checkout-status & search rate limit
  const csBad = await fetch(`${MEDUSA_URL}/store/checkout-status`, {
    headers: pubKeyHeader,
  });
  const csMissing = await fetch(`${MEDUSA_URL}/store/checkout-status?cart_id=cart_01NONEXISTENT`, {
    headers: pubKeyHeader,
  });

  const sugStatuses: number[] = [];
  for (let i = 0; i < 61; i++) {
    const r = await fetch(`${WEB_URL}/api/search/suggestions?q=test`);
    sugStatuses.push(r.status);
  }
  const medusaSearchStatuses: number[] = [];
  for (let i = 0; i < 61; i++) {
    const r = await fetch(`${MEDUSA_URL}/store/search?q=test`, {
      headers: { ...pubKeyHeader, "X-Forwarded-For": `192.0.2.${(i % 200) + 1}` },
    });
    medusaSearchStatuses.push(r.status);
  }

  const step8Pass =
    csBad.status === 400 &&
    csMissing.status === 404 &&
    sugStatuses.some((s) => s === 200) &&
    sugStatuses[60] === 429 &&
    medusaSearchStatuses[60] === 429;
  recordStep(
    8,
    "Checkout Status (400/404) & Search Rate Limits (60 OK -> 61st 429)",
    step8Pass,
    `checkout-status: bad=${csBad.status}, missing=${csMissing.status}; suggestions[60]=${sugStatuses[60]}; store/search[60]=${medusaSearchStatuses[60]}`,
  );

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`\n❌ verify:security FAILED (${failed.length}/${results.length} steps failed).`);
    process.exit(1);
  }
  console.log(`\n✅ verify:security PASSED (${results.length}/${results.length} steps passed).`);
}

run().catch((err) => {
  console.error("Fatal error in verify-security:", err);
  process.exit(1);
});
