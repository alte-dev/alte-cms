/**
 * E2E Live Verification Script for Contact Form & 3-Tier Roles
 *
 * Strict LIVE HTTP Verification:
 * 1. GET /iletisim returns HTTP 200 and renders contact form, contact info, and Google Maps embed
 * 2. Anonymous GET /admin/contact-messages on Medusa is rejected (401)
 * 3. POST /api/contact rejects cross-origin (403), invalid payload (400), honeypot (400)
 * 4. POST /api/contact accepts valid submission (201) and persists to Medusa
 * 5. Payload shop-manager CANNOT update /api/globals/site-settings (403)
 * 6. Medusa Admin GET / PATCH / DELETE /admin/contact-messages works end-to-end
 */

import path from "path";
import dotenv from "dotenv";
import { createStepRecorder } from "./lib/verify-step";

dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/medusa/.env") });
dotenv.config();

const STORE_URL =
  process.env.STOREFRONT_URL || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3100";
const MEDUSA_URL = (process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000").replace(/\/+$/, "");
const { results, recordStep } = createStepRecorder({ format: "step" });

interface AuthResult {
  cookie: string;
  headers: Record<string, string>;
}

async function loginMedusaAdmin(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { token?: string };
  return data.token || null;
}

async function loginPayloadUser(email: string, password: string): Promise<AuthResult | null> {
  const res = await fetch(`${STORE_URL}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const setCookie = res.headers.get("set-cookie") || "";
  const json = (await res.json().catch(() => ({}))) as { token?: string };
  const match = setCookie.match(/payload-token=([^;]+)/);
  const token = match?.[1] || json.token || "";
  if (!token) return null;
  const cookie = `payload-token=${token}`;
  return {
    cookie,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Authorization: `JWT ${token}`,
    },
  };
}

async function ensureStaffUser(
  adminHeaders: Record<string, string>,
  email: string,
  password: string,
  role: "shop-manager" | "editor",
  name: string,
): Promise<void> {
  const existing = await loginPayloadUser(email, password);
  if (existing) return;

  await fetch(`${STORE_URL}/api/users`, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({ email, password, role, name }),
  });
}

async function main() {
  console.log(`\n🚀 Başlatılıyor: verify:contact (${STORE_URL})\n`);

  // 1. /iletisim page renders 200 with form, contact info and Google Maps
  const pageRes = await fetch(`${STORE_URL}/iletisim`);
  const pageHtml = await pageRes.text();
  recordStep(
    "1. /iletisim sayfası canlı HTTP 200 (form + harita + iletişim)",
    pageRes.ok &&
      pageHtml.includes("contact-name") &&
      pageHtml.includes("contact-kvkk") &&
      pageHtml.includes("maps.google.com/maps") &&
      pageHtml.includes("tel:") &&
      pageHtml.includes("mailto:"),
    `status=${pageRes.status}`,
  );

  // 2. Anonymous GET /admin/contact-messages on Medusa blocked
  const anonReadRes = await fetch(`${MEDUSA_URL}/admin/contact-messages`);
  recordStep(
    "2. Anonim Medusa /admin/contact-messages okuma engelli (401/403)",
    anonReadRes.status === 401 || anonReadRes.status === 403,
    `status=${anonReadRes.status}`,
  );

  // 3a. Cross-origin POST /api/contact blocked
  const evilOriginRes = await fetch(`${STORE_URL}/api/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://evil.example.test",
    },
    body: JSON.stringify({}),
  });
  recordStep(
    "3a. Farklı Origin POST /api/contact reddedilir (403)",
    evilOriginRes.status === 403,
    `status=${evilOriginRes.status}`,
  );

  // 3b. Invalid payload (no KVKK) rejected
  const invalidRes = await fetch(`${STORE_URL}/api/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: STORE_URL,
    },
    body: JSON.stringify({
      name: "Test Kullanıcı",
      email: "test-contact@example.test",
      subject: "Bilgi",
      message: "Bu geçerli uzunlukta bir test mesajıdır.",
      kvkkAccepted: false,
    }),
  });
  recordStep(
    "3b. KVKK onaysız gönderim reddedilir (400)",
    invalidRes.status === 400,
    `status=${invalidRes.status}`,
  );

  // 3c. Honeypot filled rejected
  const honeypotRes = await fetch(`${STORE_URL}/api/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: STORE_URL,
    },
    body: JSON.stringify({
      name: "Bot Kullanıcı",
      email: "bot@example.test",
      subject: "Spam",
      message: "Bot tarafından doldurulan test mesajıdır.",
      kvkkAccepted: true,
      website: "https://spam.example.test",
    }),
  });
  recordStep(
    "3c. Honeypot dolu gönderim reddedilir (400)",
    honeypotRes.status === 400,
    `status=${honeypotRes.status}`,
  );

  // 4. Valid submission succeeds (201)
  const validRes = await fetch(`${STORE_URL}/api/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: STORE_URL,
    },
    body: JSON.stringify({
      name: "Canlı Doğrulama Müşterisi",
      email: "musteri-verify@example.test",
      phone: "05550000000",
      subject: "Sipariş Durumu",
      message: "Merhaba, canlı doğrulama kapsamında gönderilen test mesajıdır.",
      kvkkAccepted: true,
      website: "",
    }),
  });
  const validJson = (await validRes.json().catch(() => ({}))) as {
    ok?: boolean;
    id?: number | string;
  };
  const createdMessageId = validJson.id;
  recordStep(
    "4. Geçerli iletişim formu gönderimi kaydedilir (201)",
    validRes.status === 201 && Boolean(validJson.ok) && Boolean(createdMessageId),
    `status=${validRes.status}, id=${createdMessageId ?? "none"}`,
  );

  // 5. Payload shop-manager cannot update site-settings (403)
  const adminEmail = process.env.PAYLOAD_ADMIN_EMAIL || "admin@example.test";
  const adminPass = process.env.PAYLOAD_ADMIN_PASSWORD || "test-admin-password-123";
  const adminAuth = await loginPayloadUser(adminEmail, adminPass);

  if (!adminAuth) {
    recordStep("5. Payload Admin oturumu açılamadı", false, "Admin girişi başarısız");
  } else {
    const managerEmail = "verify-shop-manager@example.test";
    const managerPass = "ShopMgr123456!";

    await ensureStaffUser(
      adminAuth.headers,
      managerEmail,
      managerPass,
      "shop-manager",
      "Mağaza Yöneticisi",
    );

    const managerAuth = await loginPayloadUser(managerEmail, managerPass);
    if (managerAuth) {
      const mgrSettings = await fetch(`${STORE_URL}/api/globals/site-settings`, {
        method: "POST",
        headers: managerAuth.headers,
        body: JSON.stringify({ storeName: "Yetkisiz Değişiklik" }),
      });
      recordStep(
        "5. Mağaza yöneticisi Site Ayarlarını değiştiremez (403)",
        mgrSettings.status === 403,
        `status=${mgrSettings.status}`,
      );
    } else {
      recordStep("5. Mağaza yöneticisi oturumu açılamadı", false, "Giriş başarısız");
    }
  }

  // 6. Medusa Admin contact-messages list, update, and cleanup
  const medusaEmail = process.env.MEDUSA_ADMIN_EMAIL || "";
  const medusaPass = process.env.MEDUSA_ADMIN_PASSWORD || "";
  const medusaToken =
    medusaEmail && medusaPass ? await loginMedusaAdmin(medusaEmail, medusaPass) : null;

  if (!medusaToken) {
    recordStep(
      "6. Medusa Admin oturumu açılamadı",
      false,
      "MEDUSA_ADMIN_EMAIL/PASSWORD eksik veya hatalı",
    );
  } else if (createdMessageId) {
    const medusaHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${medusaToken}`,
    };

    const listRes = await fetch(`${MEDUSA_URL}/admin/contact-messages`, {
      headers: medusaHeaders,
    });
    const listJson = (await listRes.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
    };
    const found = Boolean(listJson.messages?.some((m) => m.id === createdMessageId));
    recordStep(
      "6a. Medusa Admin /admin/contact-messages listesi kaydedilen mesajı döner (200)",
      listRes.status === 200 && found,
      `status=${listRes.status}, found=${found}`,
    );

    const patchRes = await fetch(`${MEDUSA_URL}/admin/contact-messages/${createdMessageId}`, {
      method: "PATCH",
      headers: medusaHeaders,
      body: JSON.stringify({
        status: "in_progress",
        internal_note: "Canlı doğrulama inceleme notu",
      }),
    });
    recordStep(
      "6b. Medusa Admin iletişim mesajı durumunu/notunu güncelleyebilir (200)",
      patchRes.status === 200,
      `status=${patchRes.status}`,
    );

    const delRes = await fetch(`${MEDUSA_URL}/admin/contact-messages/${createdMessageId}`, {
      method: "DELETE",
      headers: medusaHeaders,
    });
    recordStep(
      "6c. Medusa Admin test iletişim mesajını temizler (200)",
      delRes.status === 200,
      `status=${delRes.status}`,
    );
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n📊 Sonuç: ${results.length - failed.length}/${results.length} adım geçti.`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("verify:contact kritik hata:", err);
  process.exit(1);
});
