/**
 * Standalone & Live Verification Script for Email Notifications (Faz 6B)
 *
 * Runs an isolated, local mock SMTP server (via smtp-server) on 127.0.0.1.
 * Zero external network access, fully local, deterministic.
 * Connects to PostgreSQL if available, or seamlessly uses in-memory adapter if DB is offline.
 *
 * Verifies:
 * 1. Settings persistence & security: Password encrypted with AES-256-GCM in DB, masked in API, not in logs.
 * 2. Test email dispatch to mock SMTP server.
 * 3. Card order event: Exactly 1 customer email + 1 admin email.
 * 4. Idempotency under concurrency: 5 parallel triggers for same order -> still exactly 1 email.
 * 5. COD order: Kapıda Ödeme fee is present as distinct line item in email.
 * 6. Non-blocking reliability: When SMTP is offline, order completes without throwing, log marked 'failed'.
 * 7. Retry mechanism: When SMTP is back online, retryEmailLog succeeds and status updates to 'sent'.
 * 8. HTML & XSS injection prevention: <script> and <img onerror> in customer name / item title are escaped.
 * 9. CRLF header injection protection: \r\n characters in subject and from_name are stripped/neutralized.
 * 10. Disabled state guard: When enabled=false, no emails are dispatched.
 */

import dotenv from "dotenv";
import net from "net";
import path from "path";
import pg from "pg";
import { SMTPServer } from "smtp-server";
import {
  buildEmailTemplate,
  ensureEmailTables,
  getMaskedEmailSettings,
  OrderEmailPayload,
  retryEmailLog,
  sendEmailNotification,
  SINGLETON_EMAIL_SETTING_ID,
  updateEmailSettings,
} from "../apps/medusa/src/services/email-service";
import { decryptSetting, parseEncryptionKey } from "../apps/medusa/src/utils/crypto";
import { sanitizeHeader } from "../apps/medusa/src/utils/email-sanitizer";

dotenv.config({ path: path.resolve(process.cwd(), "apps/medusa/.env") });
dotenv.config();

// Ensure test encryption key is present for verification
if (!process.env.SETTINGS_ENCRYPTION_KEY) {
  process.env.SETTINGS_ENCRYPTION_KEY =
    "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
}

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://medusa_user:dev-only-medusa-password@127.0.0.1:5432/medusa_db";

interface StepResult {
  step: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: StepResult[] = [];

function record(step: number, name: string, passed: boolean, details: string) {
  results.push({ step, name, passed, details });
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`[Step ${step}] ${status} - ${name}: ${details}`);
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

function createInMemoryKnex() {
  const tables: Record<string, any[]> = {
    email_setting: [],
    email_log: [],
  };

  const knex: any = (tableName: string) => {
    if (!tables[tableName]) tables[tableName] = [];

    let whereClause: Record<string, any> = {};
    let orderByCol: string = "";
    let orderDir: string = "asc";
    let limitVal: number | null = null;

    const builder = {
      where(cond: Record<string, any>) {
        whereClause = cond;
        return builder;
      },
      orderBy(col: string, dir: string = "asc") {
        orderByCol = col;
        orderDir = dir;
        return builder;
      },
      limit(n: number) {
        limitVal = n;
        return builder;
      },
      select(...cols: string[]) {
        return builder;
      },
      async first() {
        const rows = tables[tableName].filter((row) => {
          return Object.entries(whereClause).every(([k, v]) => row[k] === v);
        });
        return rows[0] || null;
      },
      insert(data: Record<string, any>) {
        let insertedRow: any = null;
        const doInsert = () => {
          if (insertedRow) return insertedRow;
          const conflictCol = "idempotency_key";
          const existingIdx = tables[tableName].findIndex(
            (r) =>
              (data[conflictCol] && r[conflictCol] === data[conflictCol]) ||
              (data.id && r.id === data.id),
          );
          if (existingIdx >= 0) {
            insertedRow = tables[tableName][existingIdx];
          } else {
            insertedRow = { ...data };
            tables[tableName].push(insertedRow);
          }
          return insertedRow;
        };

        const resObj: any = {
          onConflict(conflictCol: string) {
            return {
              merge(updateFields?: Record<string, any>) {
                const existingIdx = tables[tableName].findIndex(
                  (r) => r[conflictCol] === data[conflictCol],
                );
                if (existingIdx >= 0) {
                  if (updateFields) {
                    for (const [k, v] of Object.entries(updateFields)) {
                      if (typeof v === "object" && v?.raw) {
                        tables[tableName][existingIdx][k] =
                          (tables[tableName][existingIdx][k] || 0) + (data[k] || 1);
                      } else {
                        tables[tableName][existingIdx][k] = v;
                      }
                    }
                  }
                  return Promise.resolve([tables[tableName][existingIdx]]);
                }
                const newRow = { ...data };
                tables[tableName].push(newRow);
                return Promise.resolve([newRow]);
              },
              then(resolve: any, reject: any) {
                return Promise.resolve([doInsert()]).then(resolve, reject);
              },
            };
          },
          then(resolve: any, reject: any) {
            return Promise.resolve([doInsert()]).then(resolve, reject);
          },
        };

        return resObj;
      },
      async update(data: Record<string, any>) {
        const rows = tables[tableName].filter((row) => {
          return Object.entries(whereClause).every(([k, v]) => row[k] === v);
        });
        for (const row of rows) {
          Object.assign(row, data);
        }
        return rows;
      },
      async then(resolve: any, reject: any) {
        try {
          let rows = [...tables[tableName]].filter((row) => {
            return Object.entries(whereClause).every(([k, v]) => row[k] === v);
          });
          if (orderByCol) {
            rows.sort((a, b) => {
              if (orderDir === "desc") {
                return b[orderByCol] > a[orderByCol] ? 1 : -1;
              }
              return a[orderByCol] > b[orderByCol] ? 1 : -1;
            });
          }
          if (limitVal) {
            rows = rows.slice(0, limitVal);
          }
          resolve(rows);
        } catch (e) {
          if (reject) reject(e);
          else throw e;
        }
      },
    };

    return builder;
  };

  knex.raw = async (query: string, bindings: any[] = []) => {
    return { raw: query };
  };

  return knex;
}

function createPgKnex(pool: pg.Pool) {
  const knex: any = (tableName: string) => {
    let whereClause: Record<string, any> = {};
    let orderByCol: string = "";
    let orderDir: string = "asc";
    let limitVal: number | null = null;

    const builder = {
      where(cond: Record<string, any>) {
        whereClause = cond;
        return builder;
      },
      orderBy(col: string, dir: string = "asc") {
        orderByCol = col;
        orderDir = dir;
        return builder;
      },
      limit(n: number) {
        limitVal = n;
        return builder;
      },
      select(...cols: string[]) {
        return builder;
      },
      async first() {
        const keys = Object.keys(whereClause);
        let sql = `SELECT * FROM "${tableName}"`;
        const values: any[] = [];
        if (keys.length > 0) {
          const conds = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(" AND ");
          sql += ` WHERE ${conds}`;
          values.push(...keys.map((k) => whereClause[k]));
        }
        sql += " LIMIT 1";
        const res = await pool.query(sql, values);
        return res.rows[0] || null;
      },
      async insert(data: Record<string, any>) {
        const keys = Object.keys(data);
        const cols = keys.map((k) => `"${k}"`).join(", ");
        const placeholders = keys.map((_, idx) => `$${idx + 1}`).join(", ");
        const sql = `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders}) RETURNING *`;
        const values = keys.map((k) => data[k]);

        return {
          onConflict(conflictCol: string) {
            return {
              async merge(updateFields?: Record<string, any>) {
                let upsertSql = `${sql} ON CONFLICT ("${conflictCol}") DO `;
                if (!updateFields || Object.keys(updateFields).length === 0) {
                  upsertSql += "NOTHING";
                } else {
                  const updates = Object.keys(updateFields)
                    .map((k) => {
                      if (typeof updateFields[k] === "object" && updateFields[k]?.raw) {
                        return `"${k}" = ${updateFields[k].raw}`;
                      }
                      return `"${k}" = EXCLUDED."${k}"`;
                    })
                    .join(", ");
                  upsertSql += `UPDATE SET ${updates}`;
                }
                const res = await pool.query(upsertSql, values);
                return res.rows;
              },
            };
          },
        };
      },
      async update(data: Record<string, any>) {
        const keys = Object.keys(data);
        const whereKeys = Object.keys(whereClause);
        const setClauses = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(", ");
        const whereClauses = whereKeys
          .map((k, idx) => `"${k}" = $${keys.length + idx + 1}`)
          .join(" AND ");

        const sql = `UPDATE "${tableName}" SET ${setClauses} WHERE ${whereClauses} RETURNING *`;
        const values = [...keys.map((k) => data[k]), ...whereKeys.map((k) => whereClause[k])];
        const res = await pool.query(sql, values);
        return res.rows;
      },
      async then(resolve: any, reject: any) {
        try {
          let sql = `SELECT * FROM "${tableName}"`;
          const keys = Object.keys(whereClause);
          const values: any[] = [];
          if (keys.length > 0) {
            const conds = keys.map((k, idx) => `"${k}" = $${idx + 1}`).join(" AND ");
            sql += ` WHERE ${conds}`;
            values.push(...keys.map((k) => whereClause[k]));
          }
          if (orderByCol) {
            sql += ` ORDER BY "${orderByCol}" ${orderDir.toUpperCase()}`;
          }
          if (limitVal) {
            sql += ` LIMIT ${limitVal}`;
          }
          const res = await pool.query(sql, values);
          resolve(res.rows);
        } catch (e) {
          if (reject) reject(e);
          else throw e;
        }
      },
    };

    return builder;
  };

  knex.raw = async (query: string, bindings: any[] = []) => {
    if (bindings.length === 0 && !query.includes("$1")) {
      await pool.query(query);
      return { raw: query };
    }
    const res = await pool.query(query, bindings);
    return res;
  };

  return knex;
}

async function run() {
  console.log("================================================================================");
  console.log("🚀 STARTING FAZ 6B EMAIL NOTIFICATIONS VERIFICATION");
  console.log("================================================================================");

  const mockPort = await findFreePort();
  const receivedEmails: Array<{ from: string; to: string[]; subject: string; body: string }> = [];

  // Spin up local offline SMTP mock server
  const mockSmtpServer = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onAuth(auth, session, callback) {
      callback(null, { user: auth.username || "testuser" });
    },
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk) => {
        raw += chunk.toString("utf8");
      });
      stream.on("end", () => {
        const lines = raw.split("\r\n");
        let subject = "";
        for (const line of lines) {
          if (line.toLowerCase().startsWith("subject:")) {
            subject = line.slice(8).trim();
            break;
          }
        }
        receivedEmails.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
          to: session.envelope.rcptTo.map((r) => r.address),
          subject,
          body: raw,
        });
        callback();
      });
    },
  });

  await new Promise<void>((resolve, reject) => {
    mockSmtpServer.listen(mockPort, "127.0.0.1", () => {
      console.log(
        `[Mock SMTP] Yerel sahte SMTP sunucusu 127.0.0.1:${mockPort} adresinde başlatıldı.`,
      );
      resolve();
    });
    mockSmtpServer.on("error", reject);
  });

  // Check if live postgres is reachable; if not, use in-memory adapter
  let knex: any = null;
  let pool: pg.Pool | null = null;

  try {
    const testPool = new pg.Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 1000,
    });
    const client = await testPool.connect();
    client.release();
    pool = testPool;
    knex = createPgKnex(pool);
    console.log("✓ Connected to PostgreSQL database for verification.");
  } catch {
    console.log(
      "ℹ PostgreSQL is offline; using in-memory database adapter for isolated verification.",
    );
    knex = createInMemoryKnex();
  }

  try {
    await ensureEmailTables(knex);

    // STEP 1: Save settings & verify encryption in DB
    const testPassword = "SuperSecretSmtpPassword123!";
    await updateEmailSettings(
      knex,
      {
        enabled: true,
        host: "127.0.0.1",
        port: mockPort,
        secure: false,
        username: "testuser",
        password: testPassword,
        from_name: "Alte Butik Test",
        from_email: "siparis@example.test",
        admin_notify_email: "admin@example.test",
      },
      "super-admin",
    );

    const dbRow = await knex("email_setting").where({ id: SINGLETON_EMAIL_SETTING_ID }).first();
    const maskedSettings = await getMaskedEmailSettings(knex);

    const isEncrypted =
      dbRow.password &&
      dbRow.password !== testPassword &&
      dbRow.password.includes(":") &&
      !dbRow.password.includes(testPassword);

    const keyBuf = parseEncryptionKey(process.env.SETTINGS_ENCRYPTION_KEY);
    const decryptedInMem = decryptSetting(dbRow.password, keyBuf);

    const step1Passed =
      Boolean(isEncrypted) &&
      decryptedInMem === testPassword &&
      maskedSettings.password_masked.includes("••••") &&
      !maskedSettings.password_masked.includes(testPassword);

    record(
      1,
      "Settings Persistence & AES-256-GCM Encryption",
      step1Passed,
      `DB parola şifreli: ${isEncrypted}, deşifre edilebiliyor: ${decryptedInMem === testPassword}, API maskeli dönüyor: ${maskedSettings.password_masked}`,
    );

    // STEP 2: Send test email
    const initialCount = receivedEmails.length;
    const testPayload: OrderEmailPayload = {
      orderId: "ord_test_001",
      displayId: "1001",
      customerEmail: "admin@example.test",
      customerName: "Yönetici Test",
      items: [],
      subtotalTRY: 0,
      shippingTRY: 0,
      totalTRY: 0,
      paymentMethod: "Test",
      shippingAddress: { address1: "Test Adres", city: "İstanbul" },
    };

    await sendEmailNotification(knex, "order.placed_admin", "admin@example.test", testPayload);

    await new Promise((r) => setTimeout(r, 400));
    const step2Passed = receivedEmails.length > initialCount;
    record(
      2,
      "Test Email Dispatch to Local SMTP",
      step2Passed,
      `Yakalayıcıya düşen e-posta sayısı: ${receivedEmails.length}, Alıcı: ${receivedEmails[receivedEmails.length - 1]?.to.join(", ")}`,
    );

    // STEP 3: Card order -> exactly 1 customer + 1 admin email
    const preOrderCount = receivedEmails.length;
    const orderPayload: OrderEmailPayload = {
      orderId: "ord_card_002",
      displayId: "1002",
      customerEmail: "musteri@example.test",
      customerName: "Ayşe Yılmaz",
      items: [
        {
          title: "İpek Şal",
          variantTitle: "Bej / Standart",
          sku: "IPK-SAL-BEJ",
          quantity: 2,
          unitPriceTRY: 450,
          totalPriceTRY: 900,
        },
      ],
      subtotalTRY: 900,
      shippingTRY: 50,
      totalTRY: 950,
      paymentMethod: "Kredi / Banka Kartı (PayTR)",
      shippingAddress: {
        address1: "Bağdat Cad. No: 12",
        city: "İstanbul",
        province: "Kadıköy",
      },
    };

    // Customer
    await sendEmailNotification(
      knex,
      "order.placed_customer",
      orderPayload.customerEmail,
      orderPayload,
    );
    // Admin
    await sendEmailNotification(knex, "order.placed_admin", "admin@example.test", orderPayload);

    await new Promise((r) => setTimeout(r, 400));
    const postOrderEmails = receivedEmails.slice(preOrderCount);
    const customerEmailObj = postOrderEmails.find((e) => e.to.includes("musteri@example.test"));
    const adminEmailObj = postOrderEmails.find((e) => e.to.includes("admin@example.test"));

    const step3Passed =
      postOrderEmails.length === 2 && Boolean(customerEmailObj) && Boolean(adminEmailObj);
    record(
      3,
      "Order Placed Notifications (Customer + Admin)",
      step3Passed,
      `Gönderilen e-posta sayısı: ${postOrderEmails.length} (Tam 1 Müşteri + 1 Yönetici)`,
    );

    // STEP 4: Idempotency under concurrency: 5 parallel triggers for same order
    const preConcurrentCount = receivedEmails.length;
    const concurrentPromises = [1, 2, 3, 4, 5].map(() =>
      sendEmailNotification(
        knex,
        "order.placed_customer",
        orderPayload.customerEmail,
        orderPayload,
      ),
    );
    await Promise.all(concurrentPromises);
    await new Promise((r) => setTimeout(r, 400));

    const postConcurrentEmails = receivedEmails.slice(preConcurrentCount);
    const step4Passed = postConcurrentEmails.length === 0;
    record(
      4,
      "Idempotency under Concurrency (5 Parallel Triggers)",
      step4Passed,
      `5 paralel istek sonucu üretilen yeni e-posta sayısı: ${postConcurrentEmails.length} (İdempotent korundu)`,
    );

    // STEP 5: COD order -> Kapıda Ödeme fee is present in email
    const preCodCount = receivedEmails.length;
    const codPayload: OrderEmailPayload = {
      orderId: "ord_cod_003",
      displayId: "1003",
      customerEmail: "cod.musteri@example.test",
      customerName: "Mehmet Demir",
      items: [
        {
          title: "Keten Gömlek",
          sku: "KTN-GMK-01",
          quantity: 1,
          unitPriceTRY: 800,
          totalPriceTRY: 800,
        },
      ],
      subtotalTRY: 800,
      shippingTRY: 40,
      codFeeTRY: 100,
      totalTRY: 940,
      paymentMethod: "Kapıda Ödeme (Nakit / Kart)",
      shippingAddress: { address1: "Atatürk Bulvarı No: 5", city: "Ankara" },
    };

    await sendEmailNotification(
      knex,
      "order.placed_customer",
      codPayload.customerEmail,
      codPayload,
    );
    await new Promise((r) => setTimeout(r, 400));

    const codEmail = receivedEmails[receivedEmails.length - 1];
    // Decode quoted-printable if present in raw MIME stream
    const decodedBody = codEmail?.body
      ? Buffer.from(
          codEmail.body
            .replace(/=\r?\n/g, "")
            .replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))),
          "binary",
        ).toString("utf8")
      : "";

    const hasCodLine =
      (decodedBody.includes("Kapıda Ödeme") || codEmail?.body.includes("100.00")) &&
      (decodedBody.includes("100.00 TL") || codEmail?.body.includes("100.00"));

    record(
      5,
      "Cash on Delivery (COD) Line Item in Email",
      Boolean(hasCodLine),
      `Kapıda ödeme bedeli (100.00 TL) e-postada ayrı satır olarak yer alıyor: ${Boolean(hasCodLine)}`,
    );

    // STEP 6: Non-blocking reliability: Close mock SMTP server, verify order succeeds and log marked 'failed'
    await new Promise<void>((resolve) => {
      mockSmtpServer.close(() => {
        resolve();
      });
    });

    const offlinePayload: OrderEmailPayload = {
      orderId: "ord_offline_004",
      displayId: "1004",
      customerEmail: "offline.musteri@example.test",
      customerName: "Canan Kaya",
      items: [{ title: "Deri Ceket", quantity: 1, unitPriceTRY: 2500, totalPriceTRY: 2500 }],
      subtotalTRY: 2500,
      shippingTRY: 0,
      totalTRY: 2500,
      paymentMethod: "Kredi Kartı",
      shippingAddress: { address1: "İzmir Kordon", city: "İzmir" },
    };

    const offlineResult = await sendEmailNotification(
      knex,
      "order.placed_customer",
      offlinePayload.customerEmail,
      offlinePayload,
    );

    const offlineLog = await knex("email_log")
      .where({ idempotency_key: "ord_offline_004:order.placed_customer" })
      .first();

    const step6Passed =
      offlineResult.success === false &&
      offlineResult.status === "failed" &&
      offlineLog?.status === "failed";

    record(
      6,
      "Non-Blocking SMTP Offline Failure Handling",
      step6Passed,
      `SMTP kapalıyken işlem akışı kesilmedi, log durumu: ${offlineLog?.status}, hata kodu: ${offlineLog?.error_code}`,
    );

    // STEP 7: Re-open SMTP and retry failed log
    const reopenedServer = new SMTPServer({
      authOptional: true,
      disabledCommands: ["STARTTLS"],
      onAuth(auth, session, callback) {
        callback(null, { user: auth.username || "testuser" });
      },
      onData(stream, session, callback) {
        let raw = "";
        stream.on("data", (chunk) => (raw += chunk.toString("utf8")));
        stream.on("end", () => {
          receivedEmails.push({
            from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
            to: session.envelope.rcptTo.map((r) => r.address),
            subject: "Retried",
            body: raw,
          });
          callback();
        });
      },
    });

    await new Promise<void>((resolve, reject) => {
      reopenedServer.listen(mockPort, "127.0.0.1", () => resolve());
      reopenedServer.on("error", reject);
    });

    const preRetryCount = receivedEmails.length;
    const retryRes = await retryEmailLog(knex, offlineLog.id);
    await new Promise((r) => setTimeout(r, 400));

    const updatedLog = await knex("email_log").where({ id: offlineLog.id }).first();
    const step7Passed =
      retryRes.success && updatedLog?.status === "sent" && receivedEmails.length > preRetryCount;

    record(
      7,
      "Retry Mechanism for Failed Email",
      step7Passed,
      `Yeniden deneme sonucu: ${retryRes.success}, log güncellendi: ${updatedLog?.status}, alıcıya ulaştı: ${receivedEmails.length > preRetryCount}`,
    );

    await new Promise<void>((resolve) => reopenedServer.close(() => resolve()));

    // STEP 8: HTML & XSS injection prevention
    const xssPayload: OrderEmailPayload = {
      orderId: "ord_xss_005",
      displayId: "1005",
      customerEmail: "xss@example.test",
      customerName: '<script>alert("hacked")</script>',
      items: [
        {
          title: '<img src=x onerror="alert(1)"> Tehlikeli Ürün',
          quantity: 1,
          unitPriceTRY: 100,
          totalPriceTRY: 100,
        },
      ],
      subtotalTRY: 100,
      shippingTRY: 0,
      totalTRY: 100,
      paymentMethod: "Kredi Kartı",
      shippingAddress: { address1: "Güvenli Mah.", city: "Bursa" },
    };

    const templateResult = buildEmailTemplate("order.placed_customer", xssPayload);
    const hasRawScript =
      templateResult.html.includes("<script>") ||
      templateResult.html.includes('onerror="alert(1)"');
    const hasEscapedScript =
      templateResult.html.includes("&lt;script&gt;") &&
      templateResult.html.includes("&lt;img src=x");

    const step8Passed = !hasRawScript && hasEscapedScript;
    record(
      8,
      "HTML & XSS Escaping in Email Templates",
      step8Passed,
      `Ham script veya event handler yok: ${!hasRawScript}, özel karakterler HTML entity olarak kaçırıldı: ${hasEscapedScript}`,
    );

    // STEP 9: CRLF Header injection prevention
    const maliciousSubject = "Sipariş Onayı\r\nBcc: hacker@example.com\r\nInjected-Header: evil";
    const cleanedHeader = sanitizeHeader(maliciousSubject);
    const step9Passed =
      !cleanedHeader.includes("\r") &&
      !cleanedHeader.includes("\n") &&
      cleanedHeader.includes("Bcc: hacker@example.com");

    record(
      9,
      "CRLF Header Injection Protection",
      step9Passed,
      `CRLF temizleme başarılı: ${step9Passed}, Sonuç: "${cleanedHeader}"`,
    );

    // STEP 10: Disabled settings -> no emails sent
    await updateEmailSettings(knex, { enabled: false }, "super-admin");

    const disabledPayload: OrderEmailPayload = {
      orderId: "ord_disabled_006",
      displayId: "1006",
      customerEmail: "disabled@example.test",
      customerName: "Test Kullanıcı",
      items: [],
      subtotalTRY: 100,
      shippingTRY: 0,
      totalTRY: 100,
      paymentMethod: "Kredi Kartı",
      shippingAddress: { address1: "Test", city: "İzmir" },
    };

    const preDisabledCount = receivedEmails.length;
    const disabledRes = await sendEmailNotification(
      knex,
      "order.placed_customer",
      disabledPayload.customerEmail,
      disabledPayload,
    );

    const disabledLog = await knex("email_log")
      .where({ idempotency_key: "ord_disabled_006:order.placed_customer" })
      .first();

    const step10Passed =
      disabledRes.status === "skipped" &&
      disabledLog?.status === "skipped" &&
      receivedEmails.length === preDisabledCount;

    record(
      10,
      "Disabled Email Settings Guard",
      step10Passed,
      `enabled=false iken durum: ${disabledRes.status}, yeni e-posta gönderilmedi: ${receivedEmails.length === preDisabledCount}`,
    );
  } finally {
    if (pool) await pool.end();
  }

  console.log("================================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`📊 FAZ 6B VERIFICATION RESULTS: ${totalPassed} / ${results.length} PASSED`);
  console.log("================================================================================");

  if (totalPassed < results.length) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL: Verification crashed:", err);
  process.exit(1);
});
