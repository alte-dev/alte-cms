import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createTransporter, getOrCreateEmailSettings } from "../../../../services/email-service";
import { isValidEmail, sanitizeHeader } from "../../../../utils/email-sanitizer";

// In-memory rate limiter for test email: max 3 per 5 minutes per admin
const testEmailRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkTestEmailRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = testEmailRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    testEmailRateLimitMap.set(key, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 3) {
    return false;
  }
  entry.count++;
  return true;
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const adminEmail = (req as any).user?.email || "admin@example.test";
  const rateLimitKey = String((req as any).user?.id || req.ip || adminEmail);

  if (!checkTestEmailRateLimit(rateLimitKey)) {
    return res.status(429).json({
      error: "Çok fazla test e-postası gönderildi. Lütfen 5 dakika sonra tekrar deneyin.",
    });
  }

  try {
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    const settings = await getOrCreateEmailSettings(pgConnection);

    // Strictly allowed destination: admin_notify_email or currently logged-in admin email
    const recipient = settings.admin_notify_email || adminEmail;

    if (!recipient || !isValidEmail(recipient)) {
      return res.status(400).json({
        error: "Yönetici bildirim e-posta adresi (admin_notify_email) tanımlı veya geçerli değil.",
      });
    }

    const { transporter } = await createTransporter(pgConnection);

    if (!transporter) {
      return res.status(400).json({
        error:
          "E-posta ayarları kapalı veya sunucu adresi girilmemiş. Lütfen ayarları etkinleştirin.",
      });
    }

    const subject = sanitizeHeader(
      `[TEST] ${settings.from_name || "Mağaza"} E-posta Bağlantı Testi`,
    );
    const sentTime = new Date().toLocaleString("tr-TR");

    await transporter.sendMail({
      from: `"${sanitizeHeader(settings.from_name)}" <${sanitizeHeader(settings.from_email)}>`,
      to: sanitizeHeader(recipient),
      subject,
      text: `Bu bir test e-postasıdır.\n\nE-posta bildirim servisiniz başarıyla çalışmaktadır.\nSunucu: ${settings.host}:${settings.port}\nTarih: ${sentTime}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;border:1px solid #e7e5e4;border-radius:8px;">
          <h2 style="color:#16a34a;margin-top:0;">✓ E-posta Bağlantısı Başarılı</h2>
          <p>Bu bir test e-postasıdır. E-posta bildirim ayarlarınız başarıyla doğrulanmıştır.</p>
          <div style="background:#fafaf9;padding:12px;border-radius:6px;font-size:14px;">
            <p style="margin:4px 0;"><strong>Sunucu:</strong> ${settings.host}:${settings.port}</p>
            <p style="margin:4px 0;"><strong>TLS:</strong> ${settings.secure ? "Açık" : "Kapalı"}</p>
            <p style="margin:4px 0;"><strong>Zaman:</strong> ${sentTime}</p>
          </div>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: `Test e-postası başarıyla gönderildi: ${recipient}`,
      recipient,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Test e-postası gönderilemedi: ${err.message}`,
    });
  }
};
