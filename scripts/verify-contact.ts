/**
 * E2E Live Verification Script for Contact Form & 3-Tier Roles
 *
 * Strict LIVE HTTP Verification:
 * 1. GET /iletisim returns HTTP 200 and renders contact form
 * 2. Anonymous GET /api/contact-messages is rejected (401/403)
 * 3. POST /api/contact rejects cross-origin (403), invalid payload (400), honeypot (400)
 * 4. POST /api/contact accepts valid submission (201)
 * 5. Editor role cannot read /api/contact-messages (403)
 * 6. Shop-Manager role CAN read and update /api/contact-messages (200),
 *    CANNOT update /api/globals/site-settings (403),
 *    CANNOT delete /api/contact-messages/:id (403)
 * 7. Admin role cleans up test message (DELETE 200)
 */

import path from "path";
import dotenv from "dotenv";
import { createStepRecorder } from "./lib/verify-step";

dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });
dotenv.config();

const STORE_URL =
  process.env.STOREFRONT_URL || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3100";
const { results, recordStep } = createStepRecorder({ format: "step" });

interface AuthResult {
  cookie: string;
  headers: Record<string, string>;
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

  // 1. /iletisim page renders 200
  const pageRes = await fetch(`${STORE_URL}/iletisim`);
  const pageHtml = await pageRes.text();
  recordStep(
    "1. /iletisim sayfası canlı HTTP 200",
    pageRes.ok && pageHtml.includes("contact-name") && pageHtml.includes("contact-kvkk"),
    `status=${pageRes.status}`,
  );

  // 2. Anonymous GET /api/contact-messages blocked
  const anonReadRes = await fetch(`${STORE_URL}/api/contact-messages`);
  recordStep(
    "2. Anonim /api/contact-messages okuma engelli (401/403)",
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

  // 5-7. Role checks (admin, shop-manager, editor)
  const adminEmail = process.env.PAYLOAD_ADMIN_EMAIL || "admin@example.test";
  const adminPass = process.env.PAYLOAD_ADMIN_PASSWORD || "test-admin-password-123";
  const adminAuth = await loginPayloadUser(adminEmail, adminPass);

  if (!adminAuth) {
    recordStep("5. Admin oturumu açılamadı", false, "Admin girişi başarısız");
  } else {
    const managerEmail = "verify-shop-manager@example.test";
    const managerPass = "ShopMgr123456!";
    const editorEmail = "verify-editor@example.test";
    const editorPass = "Editor123456!";

    await ensureStaffUser(
      adminAuth.headers,
      managerEmail,
      managerPass,
      "shop-manager",
      "Mağaza Yöneticisi",
    );
    await ensureStaffUser(adminAuth.headers, editorEmail, editorPass, "editor", "Editör");

    const editorAuth = await loginPayloadUser(editorEmail, editorPass);
    if (editorAuth) {
      const editorRead = await fetch(`${STORE_URL}/api/contact-messages`, {
        headers: editorAuth.headers,
      });
      recordStep(
        "5. Editor rolü /api/contact-messages okuyamaz (403)",
        editorRead.status === 403,
        `status=${editorRead.status}`,
      );
    } else {
      recordStep("5. Editor oturumu açılamadı", false, "Editor girişi başarısız");
    }

    const managerAuth = await loginPayloadUser(managerEmail, managerPass);
    if (managerAuth && createdMessageId) {
      const mgrRead = await fetch(`${STORE_URL}/api/contact-messages/${createdMessageId}`, {
        headers: managerAuth.headers,
      });
      recordStep(
        "6a. Mağaza yöneticisi (shop-manager) iletişim mesajını okuyabilir (200)",
        mgrRead.status === 200,
        `status=${mgrRead.status}`,
      );

      const mgrPatch = await fetch(`${STORE_URL}/api/contact-messages/${createdMessageId}`, {
        method: "PATCH",
        headers: managerAuth.headers,
        body: JSON.stringify({
          status: "in_progress",
          internalNote: "Canlı doğrulama inceleme notu",
        }),
      });
      recordStep(
        "6b. Mağaza yöneticisi mesaj durumunu/notunu güncelleyebilir (200)",
        mgrPatch.status === 200,
        `status=${mgrPatch.status}`,
      );

      const mgrSettings = await fetch(`${STORE_URL}/api/globals/site-settings`, {
        method: "POST",
        headers: managerAuth.headers,
        body: JSON.stringify({ storeName: "Yetkisiz Değişiklik" }),
      });
      recordStep(
        "6c. Mağaza yöneticisi Site Ayarlarını değiştiremez (403)",
        mgrSettings.status === 403,
        `status=${mgrSettings.status}`,
      );

      const mgrDelete = await fetch(`${STORE_URL}/api/contact-messages/${createdMessageId}`, {
        method: "DELETE",
        headers: managerAuth.headers,
      });
      recordStep(
        "6d. Mağaza yöneticisi iletişim mesajını silemez (403)",
        mgrDelete.status === 403,
        `status=${mgrDelete.status}`,
      );
    } else {
      recordStep("6. Mağaza yöneticisi oturumu/mesaj kontrolü", false, "Giriş veya mesaj eksik");
    }

    if (createdMessageId) {
      const adminDelete = await fetch(`${STORE_URL}/api/contact-messages/${createdMessageId}`, {
        method: "DELETE",
        headers: adminAuth.headers,
      });
      recordStep(
        "7. Admin test iletişim mesajını temizler (200)",
        adminDelete.status === 200,
        `status=${adminDelete.status}`,
      );
    }
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n📊 Sonuç: ${results.length - failed.length}/${results.length} adım geçti.`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("verify:contact kritik hata:", err);
  process.exit(1);
});
