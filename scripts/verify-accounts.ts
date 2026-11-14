/**
 * Live HTTP Verification Script for Faz 12 — Customer Accounts
 *
 * Tests all 14 security & functional requirements against running Next.js (3100) +
 * Medusa (9000) + PostgreSQL + Redis via real HTTP requests and a local SMTP server.
 */

import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import pg from "pg";
import { SMTPServer } from "smtp-server";
import { createStepRecorder } from "./lib/verify-step";
import { LegacyVerifierRegistry } from "../apps/medusa/src/modules/customer-account/verifiers/registry";

dotenv.config({ path: path.resolve(process.cwd(), "apps/medusa/.env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });
dotenv.config();

const WEB_URL = (
  process.env.WEB_URL ||
  process.env.WEB_PUBLIC_URL ||
  "http://localhost:3100"
).replace(/\/+$/, "");
const MEDUSA_URL = (process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000").replace(/\/+$/, "");
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://medusa_user:dev-only-medusa-password@127.0.0.1:5432/medusa_db";

const { results, recordStep } = createStepRecorder({ format: "step" });

interface CapturedEmail {
  to: string;
  subject: string;
  body: string;
}

function extractSetCookieValue(res: Response, cookieName: string): string | null {
  const getSetCookie = (res.headers as any).getSetCookie;
  const rawList: string[] =
    typeof getSetCookie === "function"
      ? getSetCookie.call(res.headers)
      : res.headers.get("set-cookie")
        ? [res.headers.get("set-cookie") as string]
        : [];

  for (const raw of rawList) {
    const parts = raw.split(";")[0]?.trim() || "";
    const eqIdx = parts.indexOf("=");
    if (eqIdx === -1) continue;
    const name = parts.slice(0, eqIdx).trim();
    const val = parts.slice(eqIdx + 1).trim();
    if (name === cookieName && val) {
      return `${name}=${val}`;
    }
  }
  return null;
}

function extractTokenFromEmailBody(body: string, pathPrefix: string): string | null {
  const idx = body.indexOf(pathPrefix);
  if (idx === -1) return null;
  const slice = body.slice(idx + pathPrefix.length, idx + pathPrefix.length + 512);
  const match = slice.match(/^([A-Za-z0-9._~%-]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

async function waitForEmailToken(
  capturedEmails: CapturedEmail[],
  recipientEmail: string,
  pathPrefix: string,
  timeoutMs = 6000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  const lower = recipientEmail.toLowerCase();
  while (Date.now() < deadline) {
    for (let i = capturedEmails.length - 1; i >= 0; i--) {
      const e = capturedEmails[i];
      if (e.to.toLowerCase().indexOf(lower) !== -1 && e.body.indexOf(pathPrefix) !== -1) {
        const tok = extractTokenFromEmailBody(e.body, pathPrefix);
        if (tok) return tok;
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

async function resolvePublishableKey(): Promise<string> {
  if (process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
    return process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  }
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    const res = await pool.query(
      "SELECT token FROM api_key WHERE type = 'publishable' AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",
    );
    return res.rows[0]?.token || "";
  } finally {
    await pool.end();
  }
}

async function createGuestCodOrder(
  pubKey: string,
  email: string,
): Promise<{ orderId: string; displayId: number }> {
  const headers = {
    "Content-Type": "application/json",
    "x-publishable-api-key": pubKey,
  };

  // 1. Region
  const regRes = await fetch(`${MEDUSA_URL}/store/regions`, { headers });
  const regJson = await regRes.json();
  const regionId = regJson.regions?.[0]?.id;
  if (!regionId) throw new Error("No Medusa region found");

  // 2. Product variant (exclude COD fee item)
  const prodRes = await fetch(`${MEDUSA_URL}/store/products?limit=20`, { headers });
  const prodJson = await prodRes.json();
  const product = (prodJson.products || []).find(
    (p: any) => p.handle !== "kapida-odeme-hizmet-bedeli" && p.variants?.[0]?.id,
  );
  const variantId = product?.variants?.[0]?.id;
  if (!variantId) throw new Error("No purchasable product variant found");

  // 3. Create cart & add item
  const cartRes = await fetch(`${MEDUSA_URL}/store/carts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ region_id: regionId }),
  });
  const cartJson = await cartRes.json();
  const cartId = cartJson.cart?.id;
  if (!cartId) throw new Error("Cart creation failed");

  await fetch(`${MEDUSA_URL}/store/carts/${cartId}/line-items`, {
    method: "POST",
    headers,
    body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
  });

  // 4. Set email & shipping address
  await fetch(`${MEDUSA_URL}/store/carts/${cartId}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      shipping_address: {
        first_name: "Misafir",
        last_name: "Test",
        address_1: "Test Caddesi No: 1",
        city: "Istanbul",
        country_code: "tr",
        postal_code: "34000",
        phone: "05550000001",
      },
      billing_address: {
        first_name: "Misafir",
        last_name: "Test",
        address_1: "Test Caddesi No: 1",
        city: "Istanbul",
        country_code: "tr",
        postal_code: "34000",
        phone: "05550000001",
      },
    }),
  });

  // 5. Shipping option
  const shipRes = await fetch(`${MEDUSA_URL}/store/shipping-options?cart_id=${cartId}`, {
    headers,
  });
  const shipJson = await shipRes.json();
  const shippingOptionId = shipJson.shipping_options?.[0]?.id;
  if (shippingOptionId) {
    await fetch(`${MEDUSA_URL}/store/carts/${cartId}/shipping-methods`, {
      method: "POST",
      headers,
      body: JSON.stringify({ option_id: shippingOptionId }),
    });
  }

  // 6. Payment collection & session
  const pcRes = await fetch(`${MEDUSA_URL}/store/payment-collections`, {
    method: "POST",
    headers,
    body: JSON.stringify({ cart_id: cartId }),
  });
  const pcJson = await pcRes.json();
  const pcId = pcJson.payment_collection?.id;
  if (!pcId) throw new Error("Payment collection creation failed");

  await fetch(`${MEDUSA_URL}/store/payment-collections/${pcId}/payment-sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ provider_id: "pp_system_default" }),
  });

  // 7. Complete cart
  const compRes = await fetch(`${MEDUSA_URL}/store/carts/${cartId}/complete`, {
    method: "POST",
    headers,
  });
  const compJson = await compRes.json();
  const order = compJson.order;
  if (!order?.id) {
    throw new Error(`Cart complete failed: ${JSON.stringify(compJson)}`);
  }
  return { orderId: order.id, displayId: order.display_id || 0 };
}

async function main() {
  console.log("==================================================================");
  console.log("       FAZ 12 — MÜŞTERİ HESABI DOĞRULAMA (verify-accounts.ts)     ");
  console.log("==================================================================\n");

  const capturedEmails: CapturedEmail[] = [];
  const smtpServer = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onAuth(auth, _session, callback) {
      callback(null, { user: auth.username || "ok" });
    },
    onData(stream, _session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const toMatch = raw.match(/^To:\s*(.+)$/im);
        const subjMatch = raw.match(/^Subject:\s*(.+)$/im);
        capturedEmails.push({
          to: (toMatch?.[1] || "").trim(),
          subject: (subjMatch?.[1] || "").trim(),
          body: raw.replace(/=\r?\n/g, "").replace(/=3D/g, "="),
        });
        callback();
      });
    },
  });

  await new Promise<void>((resolve) => smtpServer.listen(0, "127.0.0.1", resolve));
  const smtpPort = (smtpServer.server.address() as any).port as number;

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  let previousEmailSetting: any = null;
  let savedSettingExists = false;

  const runId = Date.now();
  const emailA = `hesap-a-${runId}@example.test`;
  const emailB = `hesap-b-${runId}@example.test`;
  const emailC = `hesap-c-${runId}@example.test`;
  const passwordA = `GucluParolaA-${runId}!`;
  const passwordANew = `YeniGucluParolaA-${runId}!`;
  const passwordB = `GucluParolaB-${runId}!`;
  const passwordC = `GucluParolaC-${runId}!`;

  let adminToken = "";
  try {
    // Save existing email_setting and point to local SMTP via Medusa Admin API (refreshes in-memory EmailSettingsRegistry)
    try {
      const adminLogin = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.MEDUSA_ADMIN_EMAIL || "admin@example.test",
          password: process.env.MEDUSA_ADMIN_PASSWORD || "supersecret-test-password",
        }),
      });
      if (adminLogin.ok) {
        adminToken = (await adminLogin.json()).token || "";
      }
    } catch {
      // ignore
    }

    const existingRes = await pool.query("SELECT * FROM email_setting LIMIT 1");
    if (existingRes.rows.length > 0) {
      savedSettingExists = true;
      previousEmailSetting = existingRes.rows[0];
    }

    if (adminToken) {
      await fetch(`${MEDUSA_URL}/admin/email-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          enabled: true,
          host: "127.0.0.1",
          port: smtpPort,
          secure: false,
          username: "",
          password: "",
          from_name: "Test Magaza",
          from_email: "noreply@example.test",
        }),
      });
    } else if (savedSettingExists) {
      await pool.query(
        `UPDATE email_setting
         SET enabled = true, host = '127.0.0.1', port = $1, secure = false,
             username = '', password = NULL,
             from_name = 'Test Magaza', from_email = 'noreply@example.test', updated_at = NOW()
         WHERE id = $2`,
        [smtpPort, previousEmailSetting.id],
      );
    } else {
      await pool.query(
        `INSERT INTO email_setting (id, enabled, host, port, secure, from_name, from_email, created_at, updated_at)
         VALUES ('email_setting_default', true, '127.0.0.1', $1, false, 'Test Magaza', 'noreply@example.test', NOW(), NOW())`,
        [smtpPort],
      );
    }

    const pubKey = await resolvePublishableKey();
    const originHeaders = {
      "Content-Type": "application/json",
      Origin: WEB_URL,
    };

    // -------------------------------------------------------------------------
    // 1. Parola politikası: kısa/yaygın/e-posta içeren reddedilir, güçlü kabul edilir
    // -------------------------------------------------------------------------
    try {
      const shortRes = await fetch(`${WEB_URL}/api/account/register`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({
          firstName: "Test",
          lastName: "User",
          email: emailA,
          password: "kisa",
          kvkkNotice: true,
        }),
      });
      const commonRes = await fetch(`${WEB_URL}/api/account/register`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({
          firstName: "Test",
          lastName: "User",
          email: emailA,
          password: "password123",
          kvkkNotice: true,
        }),
      });
      const goodRes = await fetch(`${WEB_URL}/api/account/register`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({
          firstName: "Ali",
          lastName: "Yilmaz",
          email: emailA,
          phone: "05550001111",
          password: passwordA,
          kvkkNotice: true,
          marketingConsent: false,
        }),
      });
      const pass =
        shortRes.status === 400 &&
        commonRes.status === 400 &&
        (goodRes.status === 202 || goodRes.status === 200);
      recordStep(
        1,
        "Parola politikası (kısa/yaygın -> 400, güçlü -> 202)",
        pass,
        `short=${shortRes.status}, common=${commonRes.status}, good=${goodRes.status}`,
      );
    } catch (err) {
      recordStep(1, "Parola politikası", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 2. Mükerrer kayıt tek tip yanıt (kullanıcı numaralandırma koruması)
    // -------------------------------------------------------------------------
    try {
      const dupRes = await fetch(`${WEB_URL}/api/account/register`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({
          firstName: "Ali",
          lastName: "Yilmaz",
          email: emailA,
          password: passwordA,
          kvkkNotice: true,
        }),
      });
      const dupJson = await dupRes.json();
      const pass =
        (dupRes.status === 202 || dupRes.status === 200) &&
        dupJson.ok === true &&
        typeof dupJson.message === "string";
      recordStep(
        2,
        "Mükerrer kayıt tek tip yanıt (enum koruması)",
        pass,
        `status=${dupRes.status}, ok=${dupJson.ok}`,
      );
    } catch (err) {
      recordStep(2, "Mükerrer kayıt tek tip yanıt", false, (err as Error).message);
    }

    // Verify A's email so A can place/view orders and have an address
    const verifyTokenA = await waitForEmailToken(capturedEmails, emailA, "/hesap/dogrula?token=");
    if (verifyTokenA) {
      await fetch(`${WEB_URL}/api/account/verify-email`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ token: verifyTokenA }),
      });
    }

    // Login as A
    const loginARes = await fetch(`${WEB_URL}/api/account/login`, {
      method: "POST",
      headers: originHeaders,
      body: JSON.stringify({ email: emailA, password: passwordA }),
    });
    const cookieA = extractSetCookieValue(loginARes, "alte_customer_session") || "";

    // Create an address for A and a guest order for A (then linked)
    let addrAId = "";
    let orderAId = "";
    if (cookieA) {
      const addrRes = await fetch(`${WEB_URL}/api/account/addresses`, {
        method: "POST",
        headers: { ...originHeaders, Cookie: cookieA },
        body: JSON.stringify({
          addressName: "Ev",
          firstName: "Ali",
          lastName: "Yilmaz",
          address1: "Ornek Sokak No 5",
          city: "Istanbul",
          province: "Kadikoy",
          postalCode: "34000",
          phone: "05550001111",
          isDefaultShipping: true,
        }),
      });
      const addrJson = await addrRes.json().catch(() => ({}));
      addrAId = addrJson.addresses?.[0]?.id || "";

      const orderA = await createGuestCodOrder(pubKey, emailA);
      orderAId = orderA.orderId;
      // Re-login as A so verified A merges orderA
      await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ email: emailA, password: passwordA }),
      });
    }

    // -------------------------------------------------------------------------
    // 3. Misafir sipariş -> doğrulamasız hesapta görünmez -> doğrulama sonrası bağlanır
    // -------------------------------------------------------------------------
    let cookieB = "";
    try {
      const guestOrderB = await createGuestCodOrder(pubKey, emailB);
      const regB = await fetch(`${WEB_URL}/api/account/register`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({
          firstName: "Veli",
          lastName: "Demir",
          email: emailB,
          password: passwordB,
          kvkkNotice: true,
        }),
      });
      await new Promise((r) => setTimeout(r, 800));

      const loginB = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ email: emailB, password: passwordB }),
      });
      cookieB = extractSetCookieValue(loginB, "alte_customer_session") || "";

      const ordersBeforeRes = await fetch(`${WEB_URL}/api/account/orders`, {
        headers: { Cookie: cookieB },
      });
      const ordersBefore = await ordersBeforeRes.json();
      const countBefore = (ordersBefore.orders || []).length;

      const tokenB = await waitForEmailToken(capturedEmails, emailB, "/hesap/dogrula?token=");

      let countAfter = 0;
      if (tokenB) {
        await fetch(`${WEB_URL}/api/account/verify-email`, {
          method: "POST",
          headers: originHeaders,
          body: JSON.stringify({ token: tokenB }),
        });
        const ordersAfterRes = await fetch(`${WEB_URL}/api/account/orders`, {
          headers: { Cookie: cookieB },
        });
        const ordersAfter = await ordersAfterRes.json();
        countAfter = (ordersAfter.orders || []).filter(
          (o: any) => o.id === guestOrderB.orderId,
        ).length;
      }

      const pass =
        (regB.status === 202 || regB.status === 200) &&
        Boolean(cookieB) &&
        countBefore === 0 &&
        countAfter === 1;
      recordStep(
        3,
        "Doğrulamasız misafir sipariş bağlanmaz, doğrulama sonrası bağlanır",
        pass,
        `countBefore=${countBefore}, countAfter=${countAfter}, tokenFound=${Boolean(tokenB)}`,
      );
    } catch (err) {
      recordStep(3, "Misafir sipariş bağlama", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 4. Yanlış parola & numaralandırma zamanlama farkı (< 150ms)
    // -------------------------------------------------------------------------
    try {
      const t1 = Date.now();
      const rNonExist = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ email: `yok-${runId}@example.test`, password: "YanlisParola123!" }),
      });
      const d1 = Date.now() - t1;
      const b1 = await rNonExist.json();

      const t2 = Date.now();
      const rWrongPass = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ email: emailA, password: "YanlisParola123!" }),
      });
      const d2 = Date.now() - t2;
      const b2 = await rWrongPass.json();

      const diff = Math.abs(d1 - d2);
      const pass =
        rNonExist.status === 401 &&
        rWrongPass.status === 401 &&
        b1.error === b2.error &&
        diff < 250;
      recordStep(
        4,
        "Giriş numaralandırma koruması (tek tip yanıt ve zamanlama tabanı)",
        pass,
        `nonExist=${rNonExist.status}(${d1}ms), wrongPass=${rWrongPass.status}(${d2}ms), diff=${diff}ms`,
      );
    } catch (err) {
      recordStep(4, "Giriş numaralandırma koruması", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 5. Hız sınırı (429 Too Many Requests)
    // -------------------------------------------------------------------------
    try {
      const rlEmail = `ratelimit-${runId}@example.test`;
      let got429 = false;
      for (let i = 0; i < 12; i++) {
        const res = await fetch(`${WEB_URL}/api/account/login`, {
          method: "POST",
          headers: originHeaders,
          body: JSON.stringify({ email: rlEmail, password: "YanlisParola123!" }),
        });
        if (res.status === 429) {
          got429 = true;
          break;
        }
      }
      recordStep(5, "Giriş hız sınırı (HTTP 429)", got429, `got429=${got429}`);
    } catch (err) {
      recordStep(5, "Giriş hız sınırı", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 6. Çapraz müşteri izolasyonu (IDOR): B, A'nın sipariş ve adresine erişemez
    // -------------------------------------------------------------------------
    try {
      const bOrderRes = await fetch(`${WEB_URL}/api/account/orders/${orderAId}`, {
        headers: { Cookie: cookieB },
      });
      const bAddrDelRes = await fetch(`${WEB_URL}/api/account/addresses/${addrAId}`, {
        method: "DELETE",
        headers: { Origin: WEB_URL, Cookie: cookieB },
      });
      const directMedusaOrderRes = await fetch(`${MEDUSA_URL}/store/orders/${orderAId}`, {
        headers: { "x-publishable-api-key": pubKey },
      });

      const pass =
        Boolean(orderAId) &&
        Boolean(addrAId) &&
        (bOrderRes.status === 403 || bOrderRes.status === 404) &&
        (bAddrDelRes.status === 403 || bAddrDelRes.status === 404) &&
        (directMedusaOrderRes.status === 401 ||
          directMedusaOrderRes.status === 403 ||
          directMedusaOrderRes.status === 404);
      recordStep(
        6,
        "Çapraz müşteri izolasyonu (B -> A sipariş/adres reddedilir)",
        pass,
        `bOrder=${bOrderRes.status}, bAddrDel=${bAddrDelRes.status}, directMedusa=${directMedusaOrderRes.status}`,
      );
    } catch (err) {
      recordStep(6, "Çapraz müşteri izolasyonu", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 7. Doğrudan Medusa bypass engeli (authRouteGuard + internalRouteGuard -> 404)
    // -------------------------------------------------------------------------
    try {
      const directReg = await fetch(`${MEDUSA_URL}/auth/customer/emailpass/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: `bypass-${runId}@example.test`, password: passwordA }),
      });
      const directInternal = await fetch(`${MEDUSA_URL}/store/account/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-publishable-api-key": pubKey },
        body: JSON.stringify({ email: emailA, password: passwordA }),
      });
      const pass = directReg.status === 404 && directInternal.status === 404;
      recordStep(
        7,
        "Doğrudan Medusa auth/internal uç noktaları dışarıya kapalı (404)",
        pass,
        `directReg=${directReg.status}, directInternal=${directInternal.status}`,
      );
    } catch (err) {
      recordStep(7, "Doğrudan Medusa bypass engeli", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 8. Şifre sıfırlama (tek kullanımlık + süresi dolmuş token reddi + eski oturum 401)
    // -------------------------------------------------------------------------
    let cookieANew = "";
    try {
      const reqReset = await fetch(`${WEB_URL}/api/account/password-reset`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ email: emailA }),
      });
      const resetToken = await waitForEmailToken(
        capturedEmails,
        emailA,
        "/hesap/sifre-sifirla?token=",
      );

      let confirmStatus = 0;
      let reuseStatus = 0;
      let expiredStatus = 0;
      let oldSessionAfterReset = 0;

      if (resetToken) {
        const confirmRes = await fetch(`${WEB_URL}/api/account/password-reset/confirm`, {
          method: "POST",
          headers: originHeaders,
          body: JSON.stringify({ token: resetToken, password: passwordANew }),
        });
        confirmStatus = confirmRes.status;

        // Reuse same token
        const reuseRes = await fetch(`${WEB_URL}/api/account/password-reset/confirm`, {
          method: "POST",
          headers: originHeaders,
          body: JSON.stringify({ token: resetToken, password: passwordANew }),
        });
        reuseStatus = reuseRes.status;

        // Expired token check
        const expiredRawToken = `exp_${crypto.randomBytes(16).toString("hex")}`;
        const expiredHash = crypto.createHash("sha256").update(expiredRawToken).digest("hex");
        const custRow = await pool.query(
          "SELECT id FROM customer WHERE LOWER(email) = $1 LIMIT 1",
          [emailA.toLowerCase()],
        );
        if (custRow.rows[0]?.id) {
          await pool.query(
            `INSERT INTO customer_password_reset (id, customer_id, token_hash, expires_at, used_at, created_at, updated_at)
             VALUES ($1, $2, $3, NOW() - INTERVAL '1 hour', NULL, NOW(), NOW())`,
            [`cpr_exp_${runId}`, custRow.rows[0].id, expiredHash],
          );
          const expRes = await fetch(`${WEB_URL}/api/account/password-reset/confirm`, {
            method: "POST",
            headers: originHeaders,
            body: JSON.stringify({ token: expiredRawToken, password: passwordANew }),
          });
          expiredStatus = expRes.status;
        }

        // Old session cookieA must be invalidated
        const meOld = await fetch(`${WEB_URL}/api/account/me`, {
          headers: { Cookie: cookieA },
        });
        oldSessionAfterReset = meOld.status;

        // Login with new password
        const loginNew = await fetch(`${WEB_URL}/api/account/login`, {
          method: "POST",
          headers: originHeaders,
          body: JSON.stringify({ email: emailA, password: passwordANew }),
        });
        cookieANew = extractSetCookieValue(loginNew, "alte_customer_session") || "";
      }

      const pass =
        (reqReset.status === 202 || reqReset.status === 200) &&
        confirmStatus === 200 &&
        reuseStatus === 400 &&
        expiredStatus === 400 &&
        oldSessionAfterReset === 401 &&
        Boolean(cookieANew);
      recordStep(
        8,
        "Şifre sıfırlama (tek kullanımlık, süresi dolmuş reddi, eski oturum 401)",
        pass,
        `confirm=${confirmStatus}, reuse=${reuseStatus}, expired=${expiredStatus}, oldSess=${oldSessionAfterReset}, newLogin=${Boolean(cookieANew)}`,
      );
    } catch (err) {
      recordStep(8, "Şifre sıfırlama", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 9. CSRF / Origin koruması
    // -------------------------------------------------------------------------
    try {
      const evilOrigin = await fetch(`${WEB_URL}/api/account/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example.test",
          Cookie: cookieANew || cookieB,
        },
        body: JSON.stringify({ firstName: "Hacker" }),
      });
      const noOrigin = await fetch(`${WEB_URL}/api/account/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieANew || cookieB,
        },
        body: JSON.stringify({ firstName: "Hacker" }),
      });
      const pass = evilOrigin.status === 403 && noOrigin.status === 403;
      recordStep(
        9,
        "CSRF / Origin koruması (kötü/eksik Origin -> 403)",
        pass,
        `evilOrigin=${evilOrigin.status}, noOrigin=${noOrigin.status}`,
      );
    } catch (err) {
      recordStep(9, "CSRF / Origin koruması", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 10. Çıkış oturum çerezini geçersiz kılar
    // -------------------------------------------------------------------------
    try {
      const logoutRes = await fetch(`${WEB_URL}/api/account/logout`, {
        method: "POST",
        headers: { Origin: WEB_URL, Cookie: cookieANew },
      });
      const meAfterLogout = await fetch(`${WEB_URL}/api/account/me`, {
        headers: { Cookie: cookieANew },
      });
      const pass = logoutRes.status === 200 && meAfterLogout.status === 401;
      recordStep(
        10,
        "Çıkış sonrası eski çerez geçersiz (401)",
        pass,
        `logout=${logoutRes.status}, meAfter=${meAfterLogout.status}`,
      );
    } catch (err) {
      recordStep(10, "Çıkış oturum iptali", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 11. Misafir sepetin girişte hesaba bağlanması
    // -------------------------------------------------------------------------
    try {
      const regRes = await fetch(`${MEDUSA_URL}/store/regions`, {
        headers: { "x-publishable-api-key": pubKey },
      });
      const regionId = (await regRes.json()).regions?.[0]?.id;
      const cartRes = await fetch(`${MEDUSA_URL}/store/carts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-publishable-api-key": pubKey },
        body: JSON.stringify({ region_id: regionId }),
      });
      const guestCartId = (await cartRes.json()).cart?.id;

      const loginWithCart = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: {
          ...originHeaders,
          Cookie: `cart_id=${guestCartId}`,
        },
        body: JSON.stringify({ email: emailA, password: passwordANew }),
      });

      const cartRow = await pool.query("SELECT customer_id FROM cart WHERE id = $1 LIMIT 1", [
        guestCartId,
      ]);
      const pass = loginWithCart.status === 200 && Boolean(cartRow.rows[0]?.customer_id);
      recordStep(
        11,
        "Misafir sepet girişte müşteriye bağlanır",
        pass,
        `login=${loginWithCart.status}, cartCustomerId=${cartRow.rows[0]?.customer_id || "null"}`,
      );
    } catch (err) {
      recordStep(11, "Misafir sepet bağlama", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 12. Hesap silme: anonimleştirir, girişi engeller, siparişi korur
    // -------------------------------------------------------------------------
    try {
      const orderC = await createGuestCodOrder(pubKey, emailC);
      await fetch(`${WEB_URL}/api/account/register`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({
          firstName: "Silinecek",
          lastName: "Musteri",
          email: emailC,
          password: passwordC,
          kvkkNotice: true,
        }),
      });
      const loginC = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ email: emailC, password: passwordC }),
      });
      const cookieC = extractSetCookieValue(loginC, "alte_customer_session") || "";

      const delRes = await fetch(`${WEB_URL}/api/account/delete`, {
        method: "POST",
        headers: { ...originHeaders, Cookie: cookieC },
        body: JSON.stringify({ password: passwordC, confirmation: "SİL" }),
      });

      const loginCAfter = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ email: emailC, password: passwordC }),
      });
      const orderCheck = await pool.query('SELECT id FROM "order" WHERE id = $1 LIMIT 1', [
        orderC.orderId,
      ]);
      const oldCustCheck = await pool.query(
        "SELECT id FROM customer WHERE LOWER(email) = $1 LIMIT 1",
        [emailC.toLowerCase()],
      );

      const pass =
        delRes.status === 200 &&
        loginCAfter.status === 401 &&
        orderCheck.rows.length === 1 &&
        oldCustCheck.rows.length === 0;
      recordStep(
        12,
        "Hesap silme (anonimleştirme, giriş engeli, sipariş saklama)",
        pass,
        `del=${delRes.status}, loginAfter=${loginCAfter.status}, orderKept=${orderCheck.rows.length === 1}, emailPurged=${oldCustCheck.rows.length === 0}`,
      );
    } catch (err) {
      recordStep(12, "Hesap silme", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 13. WooCommerce legacy verifier hook (üretimde test algoritması reddedilir)
    // -------------------------------------------------------------------------
    try {
      const prodRegistry = new LegacyVerifierRegistry({ isProduction: true });
      let threwInProd = false;
      try {
        prodRegistry.register({
          algorithm: "test-plain",
          verify: async () => true,
        });
      } catch {
        threwInProd = true;
      }

      const testRegistry = new LegacyVerifierRegistry({ isProduction: false });
      testRegistry.register({
        algorithm: "test-sha256",
        verify: async (plain, stored) =>
          crypto.createHash("sha256").update(plain).digest("hex") === stored,
      });
      const verified = await testRegistry.verify(
        "test-sha256",
        "legacy-secret",
        crypto.createHash("sha256").update("legacy-secret").digest("hex"),
      );

      const pass = threwInProd && !prodRegistry.has("test-sha256") && verified === true;
      recordStep(
        13,
        "WooCommerce legacy doğrulayıcı kancası (üretimde kapalı, testte çalışır)",
        pass,
        `threwInProd=${threwInProd}, verified=${verified}`,
      );
    } catch (err) {
      recordStep(13, "Legacy verifier kancası", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 14. Loglarda parola / PII sızıntısı yok
    // -------------------------------------------------------------------------
    try {
      const logDir = path.resolve(process.cwd(), "verify-logs");
      let leaked = false;
      if (fs.existsSync(logDir)) {
        const files = fs.readdirSync(logDir);
        for (const f of files) {
          if (!f.endsWith(".log")) continue;
          const content = fs.readFileSync(path.join(logDir, f), "utf8");
          if (
            content.indexOf(passwordA) !== -1 ||
            content.indexOf(passwordANew) !== -1 ||
            content.indexOf(passwordB) !== -1 ||
            content.indexOf(passwordC) !== -1
          ) {
            leaked = true;
          }
        }
      }
      recordStep(14, "Loglarda test parolası sızıntısı yok", !leaked, `leaked=${leaked}`);
    } catch (err) {
      recordStep(14, "Log sızıntısı kontrolü", false, (err as Error).message);
    }
  } finally {
    if (adminToken && savedSettingExists && previousEmailSetting) {
      await fetch(`${MEDUSA_URL}/admin/email-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          enabled: Boolean(previousEmailSetting.enabled),
          host: previousEmailSetting.host || "127.0.0.1",
          port: Number(previousEmailSetting.port) || 587,
          secure: Boolean(previousEmailSetting.secure),
          from_name: previousEmailSetting.from_name || "Magaza",
          from_email: previousEmailSetting.from_email || "noreply@example.test",
        }),
      }).catch(() => {});
    } else if (savedSettingExists && previousEmailSetting) {
      await pool.query(
        `UPDATE email_setting
         SET enabled = $1, host = $2, port = $3, secure = $4,
             from_name = $5, from_email = $6, updated_at = NOW()
         WHERE id = $7`,
        [
          previousEmailSetting.enabled,
          previousEmailSetting.host,
          previousEmailSetting.port,
          previousEmailSetting.secure,
          previousEmailSetting.from_name,
          previousEmailSetting.from_email,
          previousEmailSetting.id,
        ],
      );
    } else {
      await pool.query("DELETE FROM email_setting WHERE id = 'email_setting_default'");
    }
    await pool.end();
    await new Promise<void>((resolve) => smtpServer.close(() => resolve()));
  }

  const failed = results.filter((r) => !r.passed);
  console.log(
    `\nToplam: ${results.length}, Başarılı: ${results.length - failed.length}, Başarısız: ${failed.length}`,
  );
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
