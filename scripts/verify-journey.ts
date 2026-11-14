/**
 * Live End-to-End Customer Journey Verification Script (Faz 12.2 — `verify:journey`)
 *
 * Exercises the connected customer lifecycle against the real stack
 * (Next.js + Medusa v2 + PostgreSQL + Redis + Playwright Chromium + local smtp-server):
 * 0. Local SMTP sink + fail-closed real-SMTP env guard
 * 1. Guest COD order before registration -> 1 order confirmation email
 * 2. Browser registration with XSS-containing name -> escaped verification email
 * 3. Unverified login -> guest order is NOT linked yet
 * 4. Click verification link in browser -> verified; reuse & expired token rejected
 * 5. UI login -> guest order IS linked; add default address; logout -> old cookie 401
 * 6. Authenticated UI COD checkout -> prefilled address, 1 confirmation email, idempotent retry (409)
 * 7. Order visible in /hesap/siparisler & detail; cross-customer isolation in 2nd browser context
 * 8. Admin shipment + /siparis-takip tracking + COD captured
 * 9. Password reset flow -> old sessions 401, old pass 401, new pass 200, reuse 400, unregistered 0 emails
 * 10. Account deletion -> anonymized customer, order preserved, login 401
 * 11. email_log DB PII check, verify-logs PII scan, and exact total email count
 */

import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import net from "net";
import path from "path";
import pg from "pg";
import { chromium, type Browser } from "playwright";
import { SMTPServer } from "smtp-server";
import { createStepRecorder } from "./lib/verify-step";

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
  to: string[];
  subject: string;
  messageId: string;
  raw: string;
  text: string;
  html: string;
}

function assertNoRealSmtpEnv(): void {
  const suspiciousVars = ["SMTP_HOST", "EMAIL_HOST", "MAIL_HOST", "SMTP_SERVER"];
  for (const name of suspiciousVars) {
    const val = (process.env[name] || "").trim();
    if (val && val !== "127.0.0.1" && val !== "localhost") {
      throw new Error(
        `Güvenlik koruması: ${name} ortam değişkeni yerel olmayan bir SMTP sunucusuna (${val}) işaret ediyor; test durduruldu.`,
      );
    }
  }
}

function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseRawSmtpMessage(raw: string): {
  subject: string;
  messageId: string;
  text: string;
  html: string;
} {
  const normalized = raw.replace(/\r\n/g, "\n");
  const headerEnd = normalized.indexOf("\n\n");
  const headerBlock = headerEnd >= 0 ? normalized.slice(0, headerEnd) : normalized;
  const bodyBlock = headerEnd >= 0 ? normalized.slice(headerEnd + 2) : "";

  const subjectMatch = headerBlock.match(/^Subject:\s*(.+)$/im);
  const msgIdMatch = headerBlock.match(/^Message-ID:\s*(.+)$/im);
  const decodedBody = decodeQuotedPrintable(bodyBlock);

  return {
    subject: subjectMatch ? subjectMatch[1].trim() : "",
    messageId: msgIdMatch ? msgIdMatch[1].trim() : "",
    text: decodedBody,
    html: decodedBody,
  };
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function resolvePublishableKey(): Promise<string> {
  if (process.env.MEDUSA_PUBLISHABLE_KEY) {
    return process.env.MEDUSA_PUBLISHABLE_KEY;
  }
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  try {
    const res = await pool.query(
      "SELECT token FROM api_key WHERE type = 'publishable' ORDER BY created_at DESC LIMIT 1",
    );
    return res.rows[0]?.token || "";
  } finally {
    await pool.end();
  }
}

async function waitForCapturedEmailCount(
  emails: CapturedEmail[],
  expectedTotal: number,
  timeoutMs = 15000,
): Promise<CapturedEmail | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (emails.length >= expectedTotal) {
      return emails[expectedTotal - 1] || null;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

function extractUrlFromEmail(email: CapturedEmail, pathPrefix: string): string | null {
  const combined = `${email.text}\n${email.html}`;
  const idx = combined.indexOf(pathPrefix);
  if (idx === -1) return null;
  const start = combined.lastIndexOf("http", idx);
  if (start === -1) return null;
  const slice = combined.slice(start, idx + pathPrefix.length + 512);
  const match = slice.match(/^(https?:\/\/[^\s"'<>]+)/);
  if (!match) return null;
  return match[1].replace(/&amp;/g, "&");
}

async function createGuestCodOrderViaWeb(
  pubKey: string,
  email: string,
  firstName: string,
  lastName: string,
): Promise<{ orderId: string; displayId: number; total: number }> {
  const headers = {
    "Content-Type": "application/json",
    "x-publishable-api-key": pubKey,
  };

  const regRes = await fetch(`${MEDUSA_URL}/store/regions`, { headers });
  const regJson = await regRes.json();
  const regionId = regJson.regions?.[0]?.id;
  if (!regionId) throw new Error("No Medusa region found");

  const prodRes = await fetch(`${MEDUSA_URL}/store/products?limit=20`, { headers });
  const prodJson = await prodRes.json();
  const product = (prodJson.products || []).find(
    (p: any) => p.handle !== "kapida-odeme-hizmet-bedeli" && p.variants?.[0]?.id,
  );
  const variantId = product?.variants?.[0]?.id;
  if (!variantId) throw new Error("No purchasable product variant found");

  const cartRes = await fetch(`${MEDUSA_URL}/store/carts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ region_id: regionId }),
  });
  const cartId = (await cartRes.json()).cart?.id;
  if (!cartId) throw new Error("Guest cart creation failed");

  await fetch(`${MEDUSA_URL}/store/carts/${cartId}/line-items`, {
    method: "POST",
    headers,
    body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
  });

  const shipRes = await fetch(`${MEDUSA_URL}/store/shipping-options?cart_id=${cartId}`, {
    headers,
  });
  const shipJson = await shipRes.json();
  const shippingOptionId = shipJson.shipping_options?.[0]?.id;
  if (!shippingOptionId) throw new Error("No shipping option found for guest cart");

  const checkoutRes = await fetch(`${WEB_URL}/api/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: WEB_URL,
      Cookie: `cart_id=${cartId}`,
    },
    body: JSON.stringify({
      email,
      phone: "05550001122",
      deliveryAddress: {
        firstName,
        lastName,
        city: "İstanbul",
        district: "Kadıköy",
        addressLine1: "Misafir Sokak No: 7",
        postalCode: "34710",
        countryCode: "tr",
      },
      sameAsDelivery: true,
      invoiceType: "individual",
      shippingOptionId,
      paymentMethod: "cod",
      distanceSalesContract: true,
      kvkkConsent: true,
    }),
  });

  const checkoutJson = await checkoutRes.json();
  const orderId = checkoutJson.orderId || checkoutJson.order?.id;
  if (!checkoutRes.ok || !orderId) {
    throw new Error(
      `Guest COD checkout failed (${checkoutRes.status}): ${checkoutJson.error || ""}`,
    );
  }

  return {
    orderId,
    displayId: checkoutJson.order?.display_id || 0,
    total: Number(checkoutJson.order?.total || 0),
  };
}

async function main() {
  console.log("==================================================================");
  console.log("   FAZ 12.2 — MÜŞTERİ YOLCULUĞU DOĞRULAMA (verify-journey.ts)     ");
  console.log("==================================================================\n");

  assertNoRealSmtpEnv();

  const capturedEmails: CapturedEmail[] = [];
  const smtpPort = await findFreePort();
  const smtpServer = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onAuth(auth, _session, callback) {
      callback(null, { user: auth.username || "ok" });
    },
    onData(stream, session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = parseRawSmtpMessage(raw);
        capturedEmails.push({
          to: session.envelope.rcptTo.map((r) => r.address),
          subject: parsed.subject,
          messageId: parsed.messageId,
          raw,
          text: parsed.text,
          html: parsed.html,
        });
        callback();
      });
    },
  });

  await new Promise<void>((resolve) => smtpServer.listen(smtpPort, "127.0.0.1", resolve));

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  let previousEmailSetting: any = null;
  let savedSettingExists = false;
  let adminToken = "";
  let browser: Browser | null = null;

  const runId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const emailA = `yolculuk-a-${runId}@example.test`;
  const emailB = `yolculuk-b-${runId}@example.test`;
  const unregisteredEmail = `kayitsiz-${runId}@example.test`;
  const passwordA = `YolculukParolaA-${runId}!`;
  const passwordANew = `YeniYolculukA-${runId}!`;
  const passwordB = `YolculukParolaB-${runId}!`;
  const xssFirstName = "Ayse <script>alert(1)</script>";
  const lastNameA = "Yilmaz";
  const secretPhoneA = "05559876543";
  const secretStreetA = "GizliYolculukCaddesiNo42";
  const extractedTokens: string[] = [];
  let expectedEmailCount = 0;

  try {
    // Admin login & save/configure local SMTP sink
    const adminLogin = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: process.env.MEDUSA_ADMIN_EMAIL || "admin@example.test",
        password: process.env.MEDUSA_ADMIN_PASSWORD || "supersecret-test-password",
      }),
    });
    if (!adminLogin.ok) {
      throw new Error(`Admin login failed (${adminLogin.status})`);
    }
    adminToken = (await adminLogin.json()).token || "";

    const existingRes = await pool.query("SELECT * FROM email_setting LIMIT 1");
    if (existingRes.rows.length > 0) {
      savedSettingExists = true;
      previousEmailSetting = existingRes.rows[0];
    }

    const putSmtpRes = await fetch(`${MEDUSA_URL}/admin/email-settings`, {
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
        admin_notify_email: "",
      }),
    });
    if (!putSmtpRes.ok) {
      throw new Error(`Admin email-settings PUT failed (${putSmtpRes.status})`);
    }

    const pubKey = await resolvePublishableKey();
    if (!pubKey) throw new Error("Publishable key not found");

    // Pick a purchasable product handle for UI cart addition later
    const prodRes = await fetch(`${MEDUSA_URL}/store/products?limit=20`, {
      headers: { "x-publishable-api-key": pubKey },
    });
    const prodList = (await prodRes.json()).products || [];
    const targetProduct = prodList.find(
      (p: any) => p.handle !== "kapida-odeme-hizmet-bedeli" && p.variants?.[0]?.id,
    );
    if (!targetProduct?.handle) throw new Error("No purchasable product handle found");

    // -------------------------------------------------------------------------
    // 0. Kayıt öncesi aynı e-postayla misafir COD siparişi
    // -------------------------------------------------------------------------
    let guestOrderId = "";
    try {
      const guestOrder = await createGuestCodOrderViaWeb(pubKey, emailA, "Misafir", "Musteri");
      guestOrderId = guestOrder.orderId;
      expectedEmailCount += 1;
      const guestEmail = await waitForCapturedEmailCount(capturedEmails, expectedEmailCount);
      const pass = Boolean(
        guestOrderId &&
          guestEmail &&
          guestEmail.to.indexOf(emailA) !== -1 &&
          guestEmail.messageId.length > 0,
      );
      recordStep(
        0,
        "Kayıt öncesi misafir COD siparişi ve onay e-postası",
        pass,
        `orderId=${guestOrderId}, emailCount=${capturedEmails.length}`,
      );
    } catch (err) {
      recordStep(0, "Misafir COD siparişi", false, (err as Error).message);
    }

    browser = await chromium.launch({ headless: true });

    // -------------------------------------------------------------------------
    // 1 & 2. Tarayıcıda kayıt (<script> içeren ad) + doğrulama e-postası
    // -------------------------------------------------------------------------
    let verifyUrl = "";
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();

    try {
      await pageA.goto(`${WEB_URL}/hesap/kayit`, { waitUntil: "networkidle", timeout: 20000 });
      await pageA.fill("#reg-first-name", xssFirstName);
      await pageA.fill("#reg-last-name", lastNameA);
      await pageA.fill("#reg-email", emailA);
      await pageA.fill("#reg-phone", secretPhoneA);
      await pageA.fill("#reg-password", passwordA);
      await pageA.check("#reg-kvkk");
      await pageA.locator("main form button[type='submit']").click();

      await pageA.locator("[role='status']").waitFor({ state: "visible", timeout: 15000 });
      const statusText = await pageA.locator("[role='status']").innerText();
      const uniformOk = statusText.indexOf("Kaydınız alındı") !== -1;

      expectedEmailCount += 1;
      const verEmail = await waitForCapturedEmailCount(capturedEmails, expectedEmailCount);
      verifyUrl = verEmail ? extractUrlFromEmail(verEmail, "/hesap/dogrula?token=") || "" : "";
      if (verifyUrl) {
        const tok = new URL(verifyUrl).searchParams.get("token");
        if (tok) extractedTokens.push(tok);
      }

      const exactCount = capturedEmails.length === expectedEmailCount;
      const rightRecipient = Boolean(verEmail && verEmail.to.indexOf(emailA) !== -1);
      const usesConfiguredUrl = verifyUrl.indexOf(WEB_URL) === 0;
      const noPasswordInMail = Boolean(
        verEmail &&
          verEmail.text.indexOf(passwordA) === -1 &&
          verEmail.html.indexOf(passwordA) === -1,
      );
      const xssEscaped = Boolean(
        verEmail && verEmail.html.indexOf("<script>alert(1)</script>") === -1,
      );

      recordStep(
        1,
        "Tarayıcıda kayıt + XSS kaçışlı doğrulama e-postası",
        uniformOk &&
          exactCount &&
          rightRecipient &&
          usesConfiguredUrl &&
          noPasswordInMail &&
          xssEscaped,
        `uniformOk=${uniformOk}, exactCount=${exactCount}, usesConfiguredUrl=${usesConfiguredUrl}, noPassword=${noPasswordInMail}, xssEscaped=${xssEscaped}`,
      );
    } catch (err) {
      recordStep(1, "Kayıt ve doğrulama e-postası", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 3. Doğrulamasız giriş: giriş yapılır ama misafir sipariş bağlanmaz
    // -------------------------------------------------------------------------
    try {
      await pageA.goto(`${WEB_URL}/hesap/giris`, { waitUntil: "networkidle", timeout: 20000 });
      await pageA.fill("#login-email", emailA);
      await pageA.fill("#login-password", passwordA);
      await pageA.locator("main form button[type='submit']").click();
      await pageA.waitForURL("**/hesap", { timeout: 15000 });

      await pageA.goto(`${WEB_URL}/hesap/siparisler`, { waitUntil: "networkidle", timeout: 15000 });
      const ordersTextBefore = await pageA.locator("main").innerText();
      const notLinkedBefore = ordersTextBefore.indexOf(guestOrderId) === -1;

      await pageA.click("button:has-text('Çıkış Yap')");
      await pageA.waitForURL("**/hesap/giris", { timeout: 15000 });

      recordStep(
        2,
        "Doğrulamasız hesapta misafir siparişi bağlanmaz",
        notLinkedBefore,
        `notLinkedBefore=${notLinkedBefore}`,
      );
    } catch (err) {
      recordStep(2, "Doğrulamasız giriş kontrolü", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 4. Doğrulama bağlantısına tıkla + tek kullanımlık + süresi dolmuş token
    // -------------------------------------------------------------------------
    try {
      await pageA.goto(verifyUrl, { waitUntil: "networkidle", timeout: 20000 });
      await pageA.locator("[role='status']").waitFor({ state: "visible", timeout: 15000 });
      const verifyStatusText = await pageA.locator("[role='status']").innerText();
      const verifiedInUi = verifyStatusText.indexOf("doğrulandı") !== -1;

      const rawVerifyToken = new URL(verifyUrl).searchParams.get("token") || "";
      const reuseRes = await fetch(`${WEB_URL}/api/account/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: WEB_URL },
        body: JSON.stringify({ token: rawVerifyToken }),
      });

      // Süresi dolmuş token testi (DB üzerinden geçmişe çek)
      const custRes = await pool.query(
        "SELECT id FROM customer WHERE LOWER(email) = LOWER($1) AND has_account = true AND deleted_at IS NULL LIMIT 1",
        [emailA],
      );
      const custAId = custRes.rows[0]?.id;
      const expiredRaw = crypto.randomBytes(24).toString("hex");
      const expiredHash = crypto.createHash("sha256").update(expiredRaw).digest("hex");
      await pool.query(
        `INSERT INTO customer_email_verification (id, customer_id, token_hash, expires_at, used_at, created_at, updated_at)
         VALUES ($1, $2, $3, NOW() - INTERVAL '2 hours', NULL, NOW(), NOW())`,
        [`cver_exp_${Date.now()}`, custAId, expiredHash],
      );
      const expiredRes = await fetch(`${WEB_URL}/api/account/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: WEB_URL },
        body: JSON.stringify({ token: expiredRaw }),
      });

      recordStep(
        3,
        "Doğrulama bağlantısı (UI), tekrar kullanım (400) ve süresi dolmuş token (400)",
        verifiedInUi && reuseRes.status === 400 && expiredRes.status === 400,
        `verifiedInUi=${verifiedInUi}, reuse=${reuseRes.status}, expired=${expiredRes.status}`,
      );
    } catch (err) {
      recordStep(3, "E-posta doğrulama ve token kuralları", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 5. UI giriş -> misafir siparişi görünür + adres ekle + çıkış çerez iptali
    // -------------------------------------------------------------------------
    try {
      await pageA.goto(`${WEB_URL}/hesap/giris`, { waitUntil: "networkidle", timeout: 20000 });
      await pageA.fill("#login-email", emailA);
      await pageA.fill("#login-password", passwordA);
      await pageA.locator("main form button[type='submit']").click();
      await pageA.waitForURL("**/hesap", { timeout: 15000 });

      await pageA.goto(`${WEB_URL}/hesap/siparisler`, { waitUntil: "networkidle", timeout: 15000 });
      const ordersHtmlAfter = await pageA.content();
      const guestOrderVisible = ordersHtmlAfter.indexOf(guestOrderId) !== -1;

      await pageA.goto(`${WEB_URL}/hesap/adresler`, { waitUntil: "networkidle", timeout: 15000 });
      await pageA.fill("#addr-name", "Ev Adresim");
      await pageA.fill("#addr-phone", secretPhoneA);
      await pageA.fill("#addr-first", "Ayse");
      await pageA.fill("#addr-last", lastNameA);
      await pageA.fill("#addr-line1", secretStreetA);
      await pageA.fill("#addr-city", "İstanbul");
      await pageA.fill("#addr-province", "Beşiktaş");
      await pageA.fill("#addr-postal", "34353");
      await pageA.check("#addr-default");
      await pageA.locator("main form button[type='submit']").click();
      await pageA.locator("[role='status']").waitFor({ state: "visible", timeout: 15000 });

      const cookiesBeforeLogout = await ctxA.cookies(WEB_URL);
      const sessionCookie = cookiesBeforeLogout.find((c) => c.name === "alte_customer_session");
      const oldCookieHeader = sessionCookie ? `${sessionCookie.name}=${sessionCookie.value}` : "";

      await pageA.click("button:has-text('Çıkış Yap')");
      await pageA.waitForURL("**/hesap/giris", { timeout: 15000 });

      const meAfterLogout = await fetch(`${WEB_URL}/api/account/me`, {
        headers: { Cookie: oldCookieHeader },
      });

      recordStep(
        4,
        "UI giriş, misafir siparişi bağlama, adres ekleme ve çıkışta çerez iptali (401)",
        guestOrderVisible && Boolean(oldCookieHeader) && meAfterLogout.status === 401,
        `guestOrderVisible=${guestOrderVisible}, meAfterLogout=${meAfterLogout.status}`,
      );
    } catch (err) {
      recordStep(4, "Adres ekleme ve çıkış çerez iptali", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 6. Girişli COD siparişi (UI) + kayıtlı adres dolu + idempotent e-posta
    // -------------------------------------------------------------------------
    let customerOrderId = "";
    let customerOrderDisplayId = 0;
    try {
      await pageA.goto(`${WEB_URL}/hesap/giris`, { waitUntil: "networkidle", timeout: 20000 });
      await pageA.fill("#login-email", emailA);
      await pageA.fill("#login-password", passwordA);
      await pageA.locator("main form button[type='submit']").click();
      await pageA.waitForURL("**/hesap", { timeout: 15000 });

      await pageA.goto(`${WEB_URL}/urun/${targetProduct.handle}`, {
        waitUntil: "networkidle",
        timeout: 20000,
      });
      await pageA.click("button:has-text('Sepete Ekle')");
      await pageA.waitForTimeout(800);

      const cookiesNow = await ctxA.cookies(WEB_URL);
      const cartCookie = cookiesNow.find((c) => c.name === "cart_id");
      const activeCartId = cartCookie?.value || "";

      await pageA.goto(`${WEB_URL}/odeme`, { waitUntil: "networkidle", timeout: 20000 });
      const addressVal = await pageA.locator("#addressLine1").inputValue();
      const prefilledOk = addressVal.indexOf(secretStreetA) !== -1;

      await pageA.locator("label:has-text('Kapıda Ödeme') input[type='radio']").check();
      const checkboxes = pageA.locator("main form input[type='checkbox']");
      const cbCount = await checkboxes.count();
      for (let i = 0; i < cbCount; i++) {
        const cb = checkboxes.nth(i);
        if (!(await cb.isChecked())) {
          await cb.check();
        }
      }

      const [checkoutRes] = await Promise.all([
        pageA.waitForResponse(
          (res) => res.url().indexOf("/api/checkout") !== -1 && res.request().method() === "POST",
          { timeout: 20000 },
        ),
        pageA.locator("main form button[type='submit']:visible").first().click(),
      ]);

      const checkoutPayload = await checkoutRes.json();
      customerOrderId = checkoutPayload.orderId || checkoutPayload.order?.id || "";
      let orderTotal = Number(checkoutPayload.order?.total || 0);
      if (customerOrderId) {
        const ordRes = await fetch(`${MEDUSA_URL}/admin/orders/${customerOrderId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (ordRes.ok) {
          const ordJson = await ordRes.json();
          customerOrderDisplayId = Number(ordJson.order?.display_id || 0);
          orderTotal = Number(ordJson.order?.total || orderTotal || 0);
        }
      }

      await pageA.waitForURL("**/siparis-onay**", { timeout: 20000 });

      expectedEmailCount += 1;
      const orderEmail = await waitForCapturedEmailCount(capturedEmails, expectedEmailCount);

      // Idempotent retry on same cart -> 409, no 2nd email
      const cookieHeader = cookiesNow.map((c) => `${c.name}=${c.value}`).join("; ");
      const retryCheckoutRes = await fetch(`${WEB_URL}/api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: WEB_URL,
          Cookie: `${cookieHeader}; cart_id=${activeCartId}`,
        },
        body: JSON.stringify({
          email: emailA,
          phone: secretPhoneA,
          deliveryAddress: {
            firstName: "Ayse",
            lastName: lastNameA,
            city: "İstanbul",
            district: "Beşiktaş",
            addressLine1: secretStreetA,
            postalCode: "34353",
            countryCode: "tr",
          },
          sameAsDelivery: true,
          invoiceType: "individual",
          shippingOptionId: "so_dummy_retry",
          paymentMethod: "cod",
          distanceSalesContract: true,
          kvkkConsent: true,
        }),
      });
      await new Promise((r) => setTimeout(r, 800));

      const hasCodInMail = Boolean(
        orderEmail &&
          (orderEmail.html.indexOf("Kapıda Ödeme") !== -1 ||
            orderEmail.text.indexOf("Kapıda Ödeme") !== -1),
      );
      const hasDisplayIdInMail = Boolean(
        orderEmail &&
          customerOrderDisplayId > 0 &&
          orderEmail.html.indexOf(String(customerOrderDisplayId)) !== -1,
      );
      const hasTotalInMail = Boolean(
        orderEmail && orderTotal > 0 && orderEmail.html.indexOf(String(orderTotal)) !== -1,
      );

      recordStep(
        5,
        "Girişli COD siparişi (adres dolu, doğru e-posta, idempotent tekrar)",
        prefilledOk &&
          Boolean(customerOrderId) &&
          hasCodInMail &&
          hasDisplayIdInMail &&
          hasTotalInMail &&
          retryCheckoutRes.status === 409 &&
          capturedEmails.length === expectedEmailCount,
        `prefilled=${prefilledOk}, orderId=${customerOrderId}, retry=${retryCheckoutRes.status}, emails=${capturedEmails.length}/${expectedEmailCount}`,
      );
    } catch (err) {
      recordStep(5, "Girişli COD siparişi", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 7. Sipariş detayı ve çapraz müşteri izolasyonu (2. tarayıcı bağlamı)
    // -------------------------------------------------------------------------
    try {
      await pageA.goto(`${WEB_URL}/hesap/siparisler/${customerOrderId}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      const detailTextA = await pageA.locator("main").innerText();
      const visibleToA = detailTextA.indexOf(String(customerOrderDisplayId)) !== -1;

      const ctxB = await browser.newContext();
      const pageB = await ctxB.newPage();
      await pageB.goto(`${WEB_URL}/hesap/kayit`, { waitUntil: "networkidle", timeout: 15000 });
      await pageB.fill("#reg-first-name", "Mehmet");
      await pageB.fill("#reg-last-name", "Demir");
      await pageB.fill("#reg-email", emailB);
      await pageB.fill("#reg-password", passwordB);
      await pageB.check("#reg-kvkk");
      await pageB.locator("main form button[type='submit']").click();
      await pageB.locator("[role='status']").waitFor({ state: "visible", timeout: 15000 });

      expectedEmailCount += 1;
      const verEmailB = await waitForCapturedEmailCount(capturedEmails, expectedEmailCount);
      const verifyUrlB = verEmailB
        ? extractUrlFromEmail(verEmailB, "/hesap/dogrula?token=") || ""
        : "";
      if (verifyUrlB) {
        const tokB = new URL(verifyUrlB).searchParams.get("token");
        if (tokB) extractedTokens.push(tokB);
        await pageB.goto(verifyUrlB, { waitUntil: "networkidle", timeout: 15000 });
      }

      await pageB.goto(`${WEB_URL}/hesap/giris`, { waitUntil: "networkidle", timeout: 15000 });
      await pageB.fill("#login-email", emailB);
      await pageB.fill("#login-password", passwordB);
      await pageB.locator("main form button[type='submit']").click();
      await pageB.waitForURL("**/hesap", { timeout: 15000 });

      const cookiesB = await ctxB.cookies(WEB_URL);
      const cookieHeaderB = cookiesB.map((c) => `${c.name}=${c.value}`).join("; ");
      const bOrderApiRes = await fetch(`${WEB_URL}/api/account/orders/${customerOrderId}`, {
        headers: { Cookie: cookieHeaderB },
      });

      await pageB.goto(`${WEB_URL}/hesap/siparisler/${customerOrderId}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      const detailTextB = await pageB.locator("main").innerText();
      const hiddenFromB = detailTextB.indexOf(String(customerOrderDisplayId)) === -1;

      await ctxB.close();

      recordStep(
        6,
        "Sipariş detayı ve çapraz müşteri izolasyonu (B -> A 404)",
        visibleToA && bOrderApiRes.status === 404 && hiddenFromB,
        `visibleToA=${visibleToA}, bApiStatus=${bOrderApiRes.status}, hiddenFromB=${hiddenFromB}`,
      );
    } catch (err) {
      recordStep(6, "Sipariş detayı ve izolasyon", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 8. Yönetici kargo + /siparis-takip + COD tahsilatı (captured)
    // -------------------------------------------------------------------------
    try {
      const shipRes = await fetch(
        `${MEDUSA_URL}/admin/order-operations/${customerOrderId}/shipment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            carrier_id: "yurtici",
            tracking_code: `YT${Date.now().toString().slice(-8)}`,
          }),
        },
      );

      expectedEmailCount += 1;
      const shipEmail = await waitForCapturedEmailCount(capturedEmails, expectedEmailCount);
      const hasHttpsTrack = Boolean(shipEmail && shipEmail.html.indexOf("https://") !== -1);

      const trackPage = await ctxA.newPage();
      await trackPage.goto(`${WEB_URL}/siparis-takip`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      await trackPage.fill("#no, input[name='no']", String(customerOrderDisplayId));
      await trackPage.fill("#email, input[name='email']", emailA);
      await trackPage.locator("main form button[type='submit']").click();
      await trackPage.waitForURL("**/siparis-takip**", { timeout: 15000 });
      await trackPage.waitForLoadState("networkidle");
      const trackHtml = await trackPage.content();
      const trackWorked = trackHtml.indexOf("https://") !== -1;
      await trackPage.close();

      const codRes = await fetch(
        `${MEDUSA_URL}/admin/order-operations/${customerOrderId}/cod-captured`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );
      const codJson = await codRes.json();

      recordStep(
        7,
        "Yönetici kargo ekleme, /siparis-takip ve COD tahsilatı",
        shipRes.ok && hasHttpsTrack && trackWorked && codRes.ok && codJson.cod_collected === true,
        `ship=${shipRes.status}, hasHttpsTrack=${hasHttpsTrack}, trackWorked=${trackWorked}, cod=${codRes.status}`,
      );
    } catch (err) {
      recordStep(7, "Kargo ve COD tahsilatı", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 9. Şifre sıfırlama + eski oturum iptali + kayıtsız e-posta 0 e-posta
    // -------------------------------------------------------------------------
    try {
      const cookiesBeforeReset = await ctxA.cookies(WEB_URL);
      const sessBeforeReset = cookiesBeforeReset.find((c) => c.name === "alte_customer_session");
      const oldSessCookie = sessBeforeReset
        ? `${sessBeforeReset.name}=${sessBeforeReset.value}`
        : "";

      const resetPage = await ctxA.newPage();
      await resetPage.goto(`${WEB_URL}/hesap/sifre-sifirla`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      await resetPage.fill("#reset-email", emailA);
      await resetPage.locator("main form button[type='submit']").click();
      await resetPage.locator("[role='status']").waitFor({ state: "visible", timeout: 15000 });

      expectedEmailCount += 1;
      const resetEmail = await waitForCapturedEmailCount(capturedEmails, expectedEmailCount);
      const resetUrl = resetEmail
        ? extractUrlFromEmail(resetEmail, "/hesap/sifre-sifirla?token=") || ""
        : "";
      const rawResetToken = resetUrl ? new URL(resetUrl).searchParams.get("token") || "" : "";
      if (rawResetToken) extractedTokens.push(rawResetToken);

      await resetPage.goto(resetUrl, { waitUntil: "networkidle", timeout: 15000 });
      await resetPage.fill("#reset-new-password", passwordANew);
      await resetPage.locator("main form button[type='submit']").click();
      await resetPage.locator("[role='status']").waitFor({ state: "visible", timeout: 15000 });
      await resetPage.close();

      // Eski oturum geçersiz
      const meOldSess = await fetch(`${WEB_URL}/api/account/me`, {
        headers: { Cookie: oldSessCookie },
      });
      // Eski parola reddedilir
      const loginOldPw = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: WEB_URL },
        body: JSON.stringify({ email: emailA, password: passwordA }),
      });
      // Aynı reset token ikinci kez reddedilir
      const reuseResetRes = await fetch(`${WEB_URL}/api/account/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: WEB_URL },
        body: JSON.stringify({ token: rawResetToken, password: passwordANew }),
      });
      // Kayıtsız e-posta için tek tip yanıt ve 0 e-posta
      const unregRes = await fetch(`${WEB_URL}/api/account/password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: WEB_URL },
        body: JSON.stringify({ email: unregisteredEmail }),
      });
      await new Promise((r) => setTimeout(r, 600));

      recordStep(
        8,
        "Şifre sıfırlama, eski oturum iptali, tek kullanım ve kayıtsız e-posta (0 mail)",
        meOldSess.status === 401 &&
          loginOldPw.status === 401 &&
          reuseResetRes.status === 400 &&
          unregRes.status === 202 &&
          capturedEmails.length === expectedEmailCount,
        `oldSess=${meOldSess.status}, oldPw=${loginOldPw.status}, reuse=${reuseResetRes.status}, unreg=${unregRes.status}, emails=${capturedEmails.length}/${expectedEmailCount}`,
      );
    } catch (err) {
      recordStep(8, "Şifre sıfırlama akışı", false, (err as Error).message);
    }

    // -------------------------------------------------------------------------
    // 10. Yeni parolayla UI giriş ve hesap silme (anonimleştirme)
    // -------------------------------------------------------------------------
    try {
      await pageA.goto(`${WEB_URL}/hesap/giris`, { waitUntil: "networkidle", timeout: 15000 });
      await pageA.fill("#login-email", emailA);
      await pageA.fill("#login-password", passwordANew);
      await pageA.locator("main form button[type='submit']").click();
      await pageA.waitForURL("**/hesap", { timeout: 15000 });

      await pageA.goto(`${WEB_URL}/hesap/sil`, { waitUntil: "networkidle", timeout: 15000 });
      await pageA.fill("#del-password", passwordANew);
      await pageA.fill("#del-confirm", "SİL");
      await pageA.locator("main form button[type='submit']").click();
      await pageA.waitForURL("**/hesap/giris**", { timeout: 15000 });

      const loginAfterDel = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: WEB_URL },
        body: JSON.stringify({ email: emailA, password: passwordANew }),
      });
      const orderRow = await pool.query('SELECT id, email FROM "order" WHERE id = $1', [
        customerOrderId,
      ]);
      const custAfterDel = await pool.query(
        "SELECT id, deleted_at FROM customer WHERE LOWER(email) = LOWER($1) AND has_account = true",
        [emailA],
      );

      recordStep(
        9,
        "Hesap silme (anonimleştirme, sipariş saklama, giriş 401)",
        loginAfterDel.status === 401 &&
          orderRow.rows.length === 1 &&
          custAfterDel.rows.length === 0,
        `loginAfterDel=${loginAfterDel.status}, orderKept=${orderRow.rows.length === 1}, emailPurged=${custAfterDel.rows.length === 0}`,
      );
    } catch (err) {
      recordStep(9, "Hesap silme", false, (err as Error).message);
    }

    await ctxA.close();

    // -------------------------------------------------------------------------
    // 11. email_log DB PII kontrolü, log dosyaları taraması ve tam e-posta sayısı
    // -------------------------------------------------------------------------
    try {
      const sensitiveValues = [
        emailA,
        emailB,
        passwordA,
        passwordANew,
        passwordB,
        secretPhoneA,
        secretStreetA,
        ...extractedTokens,
      ].filter((v) => v && v.length > 0);

      const emailLogRows = await pool.query(
        "SELECT id, template, recipient_masked, status, error_code FROM email_log ORDER BY created_at DESC LIMIT 100",
      );
      let dbPiiLeaked = false;
      for (const row of emailLogRows.rows) {
        const serialized = JSON.stringify(row);
        for (const secret of sensitiveValues) {
          if (serialized.indexOf(secret) !== -1) {
            dbPiiLeaked = true;
          }
        }
      }

      const logDir = path.resolve(process.cwd(), "verify-logs");
      let logFileLeaked = false;
      const logCheckSecrets = [passwordA, passwordANew, passwordB, ...extractedTokens].filter(
        (v) => v && v.length > 0,
      );
      if (fs.existsSync(logDir)) {
        for (const f of fs.readdirSync(logDir)) {
          if (!f.endsWith(".log")) continue;
          const content = fs.readFileSync(path.join(logDir, f), "utf8");
          for (const secret of logCheckSecrets) {
            if (content.indexOf(secret) !== -1) {
              logFileLeaked = true;
            }
          }
        }
      }

      const subjectsSummary = capturedEmails.map((e, i) => `${i + 1}:${e.subject}`).join(" | ");
      const exactTotalOk = capturedEmails.length === expectedEmailCount;

      recordStep(
        10,
        "email_log PII yok, loglarda sır yok ve tam e-posta sayısı",
        !dbPiiLeaked && !logFileLeaked && exactTotalOk,
        `dbPiiLeaked=${dbPiiLeaked}, logFileLeaked=${logFileLeaked}, emails=${capturedEmails.length}/${expectedEmailCount}, subjects=[${subjectsSummary}]`,
      );
    } catch (err) {
      recordStep(10, "PII ve e-posta sayısı kontrolü", false, (err as Error).message);
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
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
          admin_notify_email: previousEmailSetting.admin_notify_email || "",
        }),
      }).catch(() => {});
    } else if (savedSettingExists && previousEmailSetting) {
      await pool
        .query(
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
        )
        .catch(() => {});
    } else {
      await pool
        .query("DELETE FROM email_setting WHERE id = 'email_setting_default'")
        .catch(() => {});
    }
    await pool.end().catch(() => {});
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
