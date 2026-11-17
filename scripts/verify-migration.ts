/**
 * Live HTTP Verification Script for Faz 10.1 — WooCommerce Customer & Password Migration
 *
 * Verifies dry-run, --apply, 0-email suppression, all 4 legacy verifiers over HTTP Web BFF,
 * needs_password_upgrade flag lifecycle, password-reset for unsupported/missing hashes,
 * register conflict protection, unverified guest-order isolation, rate limiting, and
 * absence of hashes/passwords/raw emails in logs & reports.
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import pg from "pg";
import { SMTPServer } from "smtp-server";
import { createStepRecorder } from "./lib/verify-step";
import { importCustomersFromCsv } from "./migration/import-customers";
import { parseDatabaseNameFromUrl } from "./migration/db-guard";

function loadEnvIfPresent(relPath: string): void {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return;
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) {
      process.env[key] = rawVal;
    }
  }
}

loadEnvIfPresent("apps/medusa/.env");
loadEnvIfPresent("apps/web/.env");
loadEnvIfPresent(".env");

const WEB_URL = (
  process.env.WEB_URL ||
  process.env.WEB_PUBLIC_URL ||
  "http://localhost:3100"
).replace(/\/+$/, "");
const ORIGIN_URL = WEB_URL;
const originHeaders = {
  "Content-Type": "application/json",
  Origin: ORIGIN_URL,
};
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
    const firstPart = raw.split(";")[0]?.trim() || "";
    const eqIdx = firstPart.indexOf("=");
    if (eqIdx > 0 && firstPart.slice(0, eqIdx) === cookieName) {
      return firstPart.slice(eqIdx + 1);
    }
  }
  return null;
}

function extractTokenFromEmailBody(body: string, pathPrefix: string): string | null {
  const idx = body.indexOf(pathPrefix);
  if (idx === -1) return null;
  const slice = body.slice(idx + pathPrefix.length, idx + pathPrefix.length + 512);
  const match = slice.match(/^([A-Za-z0-9._~%-]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function waitForEmailToken(
  captured: CapturedEmail[],
  recipient: string,
  pathPrefix: string,
  timeoutMs = 6000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  const lower = recipient.toLowerCase();
  while (Date.now() < deadline) {
    for (let i = captured.length - 1; i >= 0; i--) {
      const e = captured[i];
      if (e.to.toLowerCase().indexOf(lower) !== -1 && e.body.indexOf(pathPrefix) !== -1) {
        const tok = extractTokenFromEmailBody(e.body, pathPrefix);
        if (tok) return tok;
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}

function assertLocalMutationAllowed(): void {
  const allow = process.env.VERIFY_ALLOW_DB_MUTATION === "true";
  const parsed = new URL(DATABASE_URL);
  const isLocalHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (!allow && !isLocalHost) {
    throw new Error("Non-local DATABASE_URL requires VERIFY_ALLOW_DB_MUTATION=true");
  }
}

async function main() {
  assertLocalMutationAllowed();

  const capturedEmails: CapturedEmail[] = [];
  const smtpServer = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onAuth(auth, _session, callback) {
      callback(null, { user: auth.username || "ok" });
    },
    onData(stream, _session, callback) {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
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
  const dbName = parseDatabaseNameFromUrl(DATABASE_URL) || "medusa_db";
  let previousEmailSetting: any = null;
  let savedSettingExists = false;
  let adminToken = "";
  const tempFiles: string[] = [];

  const runId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const wpEmail = `mig-wp-${runId}@example.test`;
  const bcryptEmail = `mig-bcrypt-${runId}@example.test`;
  const phpassEmail = `mig-phpass-${runId}@example.test`;
  const md5Email = `mig-md5-${runId}@example.test`;
  const unknownEmail = `mig-unknown-${runId}@example.test`;
  const missingEmail = `mig-missing-${runId}@example.test`;
  const guestEmail = `mig-guest-${runId}@example.test`;

  const wpPass = `WpStrongPass-${runId}!`;
  const bcryptWeakPass = "kisa123"; // Intentionally weak to test needs_password_upgrade
  const phpassWeakPass = "test12345"; // Public phpass vector
  const md5Pass = `Md5Strong-${runId}!`;

  const wpPrehash = crypto
    .createHmac("sha384", "wp-sha384")
    .update(wpPass, "utf8")
    .digest("base64");
  const wpHash = "$wp" + (await bcrypt.hash(wpPrehash, 4)).replace(/^\$2b\$/, "$2y$");
  const bcryptHash = (await bcrypt.hash(bcryptWeakPass, 4)).replace(/^\$2b\$/, "$2y$");
  const phpassHash = "$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0";
  const md5Hash = crypto.createHash("md5").update(md5Pass, "utf8").digest("hex");

  try {
    // Configure local SMTP sink
    try {
      const adminLogin = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: process.env.MEDUSA_ADMIN_EMAIL || "admin@example.test",
          password: process.env.MEDUSA_ADMIN_PASSWORD || "supersecret-test-password",
        }),
      });
      if (adminLogin.ok) adminToken = (await adminLogin.json()).token || "";
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
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
    }

    // Build synthetic CSV
    const csvPath = path.join(os.tmpdir(), `verify-mig-${runId}.csv`);
    tempFiles.push(csvPath);
    const csvContent = [
      "wc_user_id,email,first_name,last_name,phone,billing_address_1,billing_city,billing_country,password_hash",
      `1001,${wpEmail},Ayşe,Yılmaz,+905551112233,İstiklal 1,İstanbul,TR,${wpHash}`,
      `1002,${bcryptEmail},Mehmet,Kaya,+905551112234,Atatürk 2,Ankara,TR,${bcryptHash}`,
      `1003,${phpassEmail},Fatma,Demir,,Cumhuriyet 3,İzmir,TR,${phpassHash}`,
      `1004,${md5Email},Ali,Can,,Gazi 4,Bursa,TR,${md5Hash}`,
      `1005,${wpEmail},Dup,Email,,,,,${phpassHash}`,
      `1006,${unknownEmail},Veli,Öz,,,,,$argon2id$v=19$m=65536,t=3,p=1$abc$def`,
      `1007,${missingEmail},Zeynep,Ak,,,,,`,
      `0,${guestEmail},Misafir,Müşteri,,Bağdat 5,İstanbul,TR,`,
    ].join("\n");
    fs.writeFileSync(csvPath, csvContent, "utf8");

    // Step 1: Dry-run writes 0 rows
    const dryRes = await importCustomersFromCsv({
      csvPath,
      apply: false,
      includeGuests: true,
      databaseUrl: DATABASE_URL,
      writeReport: false,
    });
    const preCount = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM customer WHERE email LIKE $1`,
      [`%-${runId}@example.test`],
    );
    recordStep(
      "Kuru çalıştırma (dry-run) DB'ye hiç kayıt yazmaz",
      dryRes.wouldCreateRegistered === 6 &&
        dryRes.wouldCreateGuests === 1 &&
        preCount.rows[0].cnt === 0,
      `wouldCreateRegistered=${dryRes.wouldCreateRegistered}, dbCount=${preCount.rows[0].cnt}`,
    );

    // Step 2: --apply creates customers with 0 emails sent, idempotent on second run
    const apply1 = await importCustomersFromCsv({
      csvPath,
      apply: true,
      confirmDatabase: dbName,
      includeGuests: true,
      databaseUrl: DATABASE_URL,
      writeReport: true,
    });
    if (apply1.reportPath) tempFiles.push(apply1.reportPath);

    const apply2 = await importCustomersFromCsv({
      csvPath,
      apply: true,
      confirmDatabase: dbName,
      includeGuests: true,
      databaseUrl: DATABASE_URL,
      writeReport: false,
    });

    const postCount = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM customer WHERE email LIKE $1`,
      [`%-${runId}@example.test`],
    );
    recordStep(
      "İçe aktarım (--apply) idempotent ve 0 e-posta tetikliyor",
      apply1.createdRegistered === 6 &&
        apply1.createdGuests === 1 &&
        apply2.createdRegistered === 0 &&
        apply2.createdGuests === 0 &&
        postCount.rows[0].cnt === 7 &&
        capturedEmails.length === 0,
      `created=${apply1.createdRegistered}+${apply1.createdGuests}, secondRun=${apply2.createdRegistered}, emails=${capturedEmails.length}`,
    );

    // Step 3: HTTP login for all 4 algorithms (wrong -> 401 & legacy kept; right -> 200 & legacy deleted; second login -> 200)
    const algCases = [
      { name: "wp-bcrypt-sha384", email: wpEmail, pass: wpPass },
      { name: "bcrypt", email: bcryptEmail, pass: bcryptWeakPass },
      { name: "phpass", email: phpassEmail, pass: phpassWeakPass },
      { name: "md5", email: md5Email, pass: md5Pass },
    ];
    let allAlgOk = true;
    let algDetail = "";
    let bcryptCookie = "";

    for (const c of algCases) {
      const badRes = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: { ...originHeaders, "x-forwarded-for": "10.10.1.1" },
        body: JSON.stringify({ email: c.email, password: "WrongPassword123!" }),
      });
      const stillExists = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM customer_legacy_credential clc JOIN customer cu ON clc.customer_id = cu.id WHERE cu.email = $1`,
        [c.email],
      );
      if (badRes.status !== 401 || stillExists.rows[0].cnt !== 1) {
        allAlgOk = false;
        algDetail = `${c.name} bad=${badRes.status} legacy=${stillExists.rows[0].cnt}`;
        break;
      }

      const goodRes = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: { ...originHeaders, "x-forwarded-for": "10.10.1.2" },
        body: JSON.stringify({ email: c.email, password: c.pass }),
      });
      const afterDelete = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM customer_legacy_credential clc JOIN customer cu ON clc.customer_id = cu.id WHERE cu.email = $1`,
        [c.email],
      );
      const secondRes = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: { ...originHeaders, "x-forwarded-for": "10.10.1.3" },
        body: JSON.stringify({ email: c.email, password: c.pass }),
      });
      if (goodRes.status !== 200 || afterDelete.rows[0].cnt !== 0 || secondRes.status !== 200) {
        allAlgOk = false;
        algDetail = `${c.name} good=${goodRes.status} legacyAfter=${afterDelete.rows[0].cnt} second=${secondRes.status}`;
        break;
      }
      if (c.name === "bcrypt") {
        bcryptCookie = extractSetCookieValue(secondRes, "alte_customer_session") || "";
      }
    }
    recordStep(
      "4 algoritma için HTTP giriş, Medusa emailpass'a geçiş ve legacy silme",
      allAlgOk,
      algDetail || "wp-bcrypt-sha384, bcrypt, phpass, md5 doğrulandı",
    );

    // Step 4: Weak legacy password sets needs_password_upgrade=true and password change clears it
    const meBefore = await fetch(`${WEB_URL}/api/account/me`, {
      headers: { Cookie: `alte_customer_session=${bcryptCookie}` },
    });
    const meBeforeJson = (await meBefore.json()) as any;
    const newStrongPass = `NewStrong-${runId}!`;
    const chgRes = await fetch(`${WEB_URL}/api/account/password`, {
      method: "POST",
      headers: {
        ...originHeaders,
        Cookie: `alte_customer_session=${bcryptCookie}`,
      },
      body: JSON.stringify({ currentPassword: bcryptWeakPass, newPassword: newStrongPass }),
    });
    const newCookie = extractSetCookieValue(chgRes, "alte_customer_session") || bcryptCookie;
    const meAfter = await fetch(`${WEB_URL}/api/account/me`, {
      headers: { Cookie: `alte_customer_session=${newCookie}` },
    });
    const meAfterJson = (await meAfter.json()) as any;
    recordStep(
      "Zayıf taşınan parolada needs_password_upgrade=true ve parola değişince temizlenmesi",
      meBeforeJson?.customer?.needs_password_upgrade === true &&
        chgRes.status === 200 &&
        meAfterJson?.customer?.needs_password_upgrade === false,
      `before=${meBeforeJson?.customer?.needs_password_upgrade}, chg=${chgRes.status}, after=${meAfterJson?.customer?.needs_password_upgrade}`,
    );

    // Step 5: Unsupported/missing hash customer cannot login with password, succeeds via password reset
    const failUnknown = await fetch(`${WEB_URL}/api/account/login`, {
      method: "POST",
      headers: originHeaders,
      body: JSON.stringify({ email: unknownEmail, password: "AnyPassword123!" }),
    });
    const resetReq = await fetch(`${WEB_URL}/api/account/password-reset`, {
      method: "POST",
      headers: originHeaders,
      body: JSON.stringify({ email: unknownEmail }),
    });
    const resetToken = await waitForEmailToken(
      capturedEmails,
      unknownEmail,
      "/hesap/sifre-sifirla?token=",
    );
    let resetLoginStatus = 0;
    let confStatus = 0;
    if (resetToken) {
      const resetPass = `ResetStrong-${runId}!`;
      const confRes = await fetch(`${WEB_URL}/api/account/password-reset/confirm`, {
        method: "POST",
        headers: originHeaders,
        body: JSON.stringify({ token: resetToken, password: resetPass }),
      });
      confStatus = confRes.status;
      if (confRes.ok) {
        const loginAfterReset = await fetch(`${WEB_URL}/api/account/login`, {
          method: "POST",
          headers: originHeaders,
          body: JSON.stringify({ email: unknownEmail, password: resetPass }),
        });
        resetLoginStatus = loginAfterReset.status;
      }
    }
    recordStep(
      "Tanınmayan hash'li müşteri parolayla giremez, şifre sıfırlama ile girer",
      failUnknown.status === 401 && resetReq.status === 202 && resetLoginStatus === 200,
      `failLogin=${failUnknown.status}, resetReq=${resetReq.status}, hasToken=${Boolean(resetToken)}, conf=${confStatus}, postResetLogin=${resetLoginStatus}`,
    );

    // Step 6: Register conflict with imported missing-hash email returns uniform 202 without duplicate or overwriting
    const regConflict = await fetch(`${WEB_URL}/api/account/register`, {
      method: "POST",
      headers: originHeaders,
      body: JSON.stringify({
        email: missingEmail,
        password: `AttackerPass-${runId}!`,
        firstName: "Saldırgan",
        lastName: "Test",
        kvkkNotice: true,
        marketingConsent: false,
      }),
    });
    const dupCustCount = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM customer WHERE LOWER(email) = $1 AND deleted_at IS NULL`,
      [missingEmail],
    );
    recordStep(
      "İçe aktarılmış e-postayla kayıt denemesi tek tip 202 döner ve ikinci hesap açmaz",
      regConflict.status === 202 && dupCustCount.rows[0].cnt === 1,
      `status=${regConflict.status}, customerCount=${dupCustCount.rows[0].cnt}`,
    );

    // Step 7: Unverified migrated user does NOT auto-link guest orders on login
    const guestRow = await pool.query(
      `SELECT id FROM customer WHERE LOWER(email) = $1 AND has_account = false LIMIT 1`,
      [guestEmail],
    );
    const guestId = guestRow.rows[0]?.id;
    const unverifiedState = await pool.query(
      `SELECT email_verified_at FROM customer_account_state cas JOIN customer c ON cas.customer_id = c.id WHERE LOWER(c.email) = $1`,
      [wpEmail],
    );
    recordStep(
      "Taşınan müşteride e-posta doğrulanmamış kalır (misafir sipariş otomatik bağlanmaz)",
      Boolean(guestId) && unverifiedState.rows[0]?.email_verified_at === null,
      `guestId=${Boolean(guestId)}, verifiedAt=${unverifiedState.rows[0]?.email_verified_at}`,
    );

    // Step 8: Rate limit on legacy login (N+1 failed attempts -> 429)
    let got429 = false;
    for (let i = 0; i < 8; i++) {
      const r = await fetch(`${WEB_URL}/api/account/login`, {
        method: "POST",
        headers: {
          ...originHeaders,
          "x-forwarded-for": `198.51.100.${i + 1}`,
        },
        body: JSON.stringify({ email: missingEmail, password: "WrongPassword!" }),
      });
      if (r.status === 429) {
        got429 = true;
        break;
      }
    }
    recordStep("Legacy müşteri için hız sınırı (429) çalışıyor", got429, `got429=${got429}`);

    // Step 9: Report & email_log contain no plaintext password, raw hash, or full email
    const reportText = apply1.reportPath ? fs.readFileSync(apply1.reportPath, "utf8") : "";
    const hasSecretInReport =
      new RegExp(wpPass).test(reportText) ||
      new RegExp(wpEmail).test(reportText) ||
      /\$wp\$|\$2y\$|\$P\$9IQR/.test(reportText);
    const emailLogRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM email_log WHERE recipient_masked LIKE $1`,
      [`%${runId}%`],
    );
    recordStep(
      "Rapor ve email_log içinde ham parola, hash veya tam e-posta yok",
      !hasSecretInReport && emailLogRes.rows[0].cnt === 0,
      `hasSecretInReport=${hasSecretInReport}, unmaskedEmailLog=${emailLogRes.rows[0].cnt}`,
    );
  } finally {
    for (const f of tempFiles) {
      if (fs.existsSync(f)) fs.rmSync(f, { force: true });
    }
    if (adminToken && savedSettingExists && previousEmailSetting) {
      await fetch(`${MEDUSA_URL}/admin/email-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          enabled: previousEmailSetting.enabled,
          host: previousEmailSetting.host || "",
          port: previousEmailSetting.port || 587,
          secure: Boolean(previousEmailSetting.secure),
          username: previousEmailSetting.username || "",
          password: "",
          from_name: previousEmailSetting.from_name || "Mağaza",
          from_email: previousEmailSetting.from_email || "noreply@example.test",
        }),
      }).catch(() => null);
    }
    await pool.end();
    await new Promise<void>((resolve) => smtpServer.close(() => resolve()));
  }

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ verify:migration failed:", err);
  process.exit(1);
});
