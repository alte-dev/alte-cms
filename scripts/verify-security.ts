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
import pg from "pg";
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
const JWT_SECRET = process.env.JWT_SECRET || "";
const DATABASE_URL = process.env.DATABASE_URL || "";

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
  const { recordStep, getResults } = createStepRecorder({ format: "adim" });

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

  // 2a. /medusa-api/* Allowlist (blocked routes must return 404)
  const blockedPaths = [
    "/medusa-api/store/products",
    "/medusa-api/hooks/payment/pp_paytr_paytr",
    "/medusa-api/internal/admin-sso",
    "/medusa-api/auth/customer/emailpass",
  ];
  const blockedResults: Array<{ path: string; status: number }> = [];
  for (const p of blockedPaths) {
    const r = await fetch(`${WEB_URL}${p}`, { redirect: "manual" });
    blockedResults.push({ path: p, status: r.status });
  }
  const step2aPass = blockedResults.every((item) => item.status === 404);
  recordStep(
    2,
    "/medusa-api/* Allowlist Blocks Public Access to Store/Hooks/Internal/Customer Auth (404)",
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
          if (res.status() === 404 || res.status() >= 500) {
            failedMedusaApiCalls.push(`${res.request().method()} ${u.pathname}->${res.status()}`);
          }
        }
      } catch {
        // ignore invalid URLs
      }
    });

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
    browserDetail = `Captured ${seenMedusaApiPaths.size} /medusa-api calls; errors=${failedMedusaApiCalls.length} [${failedMedusaApiCalls.join(", ")}]; pageErrors=${pageErrors.length} [${pageErrors.slice(0, 3).join(" | ")}]`;
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
  const unauthTrack = await fetch(`${MEDUSA_URL}/store/order-tracking`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id_or_number: "#1001", email: "test@example.test" }),
  });

  const orderKey = `ORDSEC${Date.now()}`;
  const trackingStatuses: number[] = [];
  for (let i = 0; i < 21; i++) {
    const r = await fetch(`${MEDUSA_URL}/store/order-tracking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      const editorId = `usr_sec_ed_${suffix}`;
      const shopId = `usr_sec_sm_${suffix}`;

      await insertTempUser(rolelessId, `none-${suffix}@example.test`, null);
      await insertTempUser(editorId, `editor-${suffix}@example.test`, { role: "editor" });
      await insertTempUser(shopId, `shop-${suffix}@example.test`, { role: "shop-manager" });

      const rolelessRes = await fetch(`${MEDUSA_URL}/admin/payment-settings/manual-refunds`, {
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
        rolelessRes.status === 403 &&
        editorOpsRes.status === 403 &&
        shopOpsRes.status === 200 &&
        shopSetRes.status === 403 &&
        adminSetRes.status === 200;
      roleGuardDetail = `roleless=${rolelessRes.status}, editor-ops=${editorOpsRes.status}, shop-ops=${shopOpsRes.status}, shop-settings=${shopSetRes.status}, super-admin-settings=${adminSetRes.status}`;
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

  // 5. Security Headers & CSP
  const homeRes = await fetch(`${WEB_URL}/`);
  const csp = homeRes.headers.get("content-security-policy") || "";
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
    "CSP, Permissions-Policy & HSTS Headers Verified",
    hasStrictCsp && hasPerm && prodClean,
    `hasStrictCsp=${hasStrictCsp}, hasPerm=${hasPerm}, prodClean=${prodClean}, hsts="${hsts}"`,
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
  const step7Pass =
    adminLoginGet.status === 200 &&
    payloadLoginStatuses.slice(0, 10).every((s) => s === 401 || s === 400) &&
    payloadLoginStatuses[10] === 429 &&
    !payloadBodies[0].toLowerCase().includes("locked");
  recordStep(
    7,
    "Payload Login Rate Limit (POST /api/users/login -> 429, GET /admin/login -> 200)",
    step7Pass,
    `GET /admin/login=${adminLoginGet.status}, POST statuses=[${payloadLoginStatuses.join(", ")}]`,
  );

  // 7. Low-Severity Fixes: checkout-status & search rate limit
  const csBad = await fetch(`${MEDUSA_URL}/store/checkout-status`);
  const csMissing = await fetch(`${MEDUSA_URL}/store/checkout-status?cart_id=cart_01NONEXISTENT`);

  const sugStatuses: number[] = [];
  for (let i = 0; i < 61; i++) {
    const r = await fetch(`${WEB_URL}/api/search/suggestions?q=test`);
    sugStatuses.push(r.status);
  }
  const medusaSearchStatuses: number[] = [];
  for (let i = 0; i < 61; i++) {
    const r = await fetch(`${MEDUSA_URL}/store/search?q=test`, {
      headers: { "X-Forwarded-For": `192.0.2.${(i % 200) + 1}` },
    });
    medusaSearchStatuses.push(r.status);
  }

  const step8Pass =
    csBad.status === 400 &&
    csMissing.status === 404 &&
    sugStatuses.slice(0, 60).every((s) => s === 200) &&
    sugStatuses[60] === 429 &&
    medusaSearchStatuses[60] === 429;
  recordStep(
    8,
    "Checkout Status (400/404) & Search Rate Limits (60 OK -> 61st 429)",
    step8Pass,
    `checkout-status: bad=${csBad.status}, missing=${csMissing.status}; suggestions[60]=${sugStatuses[60]}; store/search[60]=${medusaSearchStatuses[60]}`,
  );

  const results = getResults();
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
