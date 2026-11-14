import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { createTransporter } from "../../../../services/email-service";
import { escapeHtml, isValidEmail, sanitizeHeader } from "../../../../utils/email-sanitizer";

const submissionPayloadSchema = z.object({
  type: z.literal("submission"),
  storeName: z.string().min(1).max(120),
  storeUrl: z.string().max(300).optional(),
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().email().max(200),
  customerPhone: z.string().max(40).optional(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  recipientEmail: z.string().email().max(200).optional(),
  autoReplyEnabled: z.boolean().default(true),
  autoReplySubject: z.string().min(1).max(200).default("Mesajınızı aldık"),
  autoReplyIntro: z
    .string()
    .min(1)
    .max(2000)
    .default(
      "Mesajınız bize ulaştı. Ekibimiz talebinizi inceleyip en kısa sürede sizinle iletişime geçecektir.",
    ),
});

const replyPayloadSchema = z.object({
  type: z.literal("reply"),
  storeName: z.string().min(1).max(120),
  customerName: z.string().min(1).max(120),
  customerEmail: z.string().email().max(200),
  originalSubject: z.string().min(1).max(200),
  replyMessage: z.string().min(1).max(5000),
});

const contactEmailSchema = z.discriminatedUnion("type", [
  submissionPayloadSchema,
  replyPayloadSchema,
]);

function renderEmailShell(storeName: string, title: string, bodyHtml: string): string {
  const safeStore = escapeHtml(storeName);
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8" /><title>${safeTitle}</title></head>
<body style="margin:0;padding:24px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:#0f172a;color:#ffffff;padding:20px 24px;">
      <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">${safeStore}</p>
      <h1 style="margin:6px 0 0;font-size:20px;font-weight:600;">${safeTitle}</h1>
    </div>
    <div style="padding:24px;line-height:1.6;font-size:15px;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      Bu e-posta ${safeStore} iletişim sistemi üzerinden gönderilmiştir.
    </div>
  </div>
</body>
</html>`;
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = contactEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Geçersiz e-posta verisi." });
  }

  const pgConnection =
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
    req.scope.resolve("__pg_connection__");

  const { transporter, settings } = await createTransporter(pgConnection);
  if (!transporter || !settings) {
    return res.status(503).json({
      error: "SMTP e-posta servisi aktif veya yapılandırılmış değil.",
    });
  }

  const fromHeader = `"${sanitizeHeader(settings.from_name || parsed.data.storeName)}" <${sanitizeHeader(settings.from_email)}>`;
  const replyToHeader = settings.reply_to ? sanitizeHeader(settings.reply_to) : undefined;

  try {
    if (parsed.data.type === "submission") {
      const data = parsed.data;
      const storeRecipient = data.recipientEmail || settings.admin_notify_email || "";
      let storeNotification = false;
      let customerAutoReply = false;

      if (storeRecipient && isValidEmail(storeRecipient)) {
        const subject = sanitizeHeader(`[İletişim Formu] ${data.subject}`);
        const htmlBody = renderEmailShell(
          data.storeName,
          "Yeni İletişim Formu Mesajı",
          `
            <p>Web sitenizdeki iletişim formundan yeni bir mesaj gönderildi.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr><td style="padding:6px 0;color:#64748b;width:130px;">Gönderen:</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(data.customerName)}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b;">E-posta:</td><td style="padding:6px 0;">${escapeHtml(data.customerEmail)}</td></tr>
              ${data.customerPhone ? `<tr><td style="padding:6px 0;color:#64748b;">Telefon:</td><td style="padding:6px 0;">${escapeHtml(data.customerPhone)}</td></tr>` : ""}
              <tr><td style="padding:6px 0;color:#64748b;">Konu:</td><td style="padding:6px 0;">${escapeHtml(data.subject)}</td></tr>
            </table>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;white-space:pre-wrap;">${escapeHtml(data.message)}</div>
          `,
        );

        await transporter.sendMail({
          from: fromHeader,
          to: sanitizeHeader(storeRecipient),
          replyTo: sanitizeHeader(data.customerEmail),
          subject,
          text: `Yeni İletişim Mesajı\nGönderen: ${data.customerName} (${data.customerEmail})\nKonu: ${data.subject}\n\n${data.message}`,
          html: htmlBody,
        });
        storeNotification = true;
      }

      if (data.autoReplyEnabled && isValidEmail(data.customerEmail)) {
        const autoSubject = sanitizeHeader(`${data.autoReplySubject} — ${data.storeName}`);
        const htmlBody = renderEmailShell(
          data.storeName,
          data.autoReplySubject,
          `
            <p>Merhaba <strong>${escapeHtml(data.customerName)}</strong>,</p>
            <p style="white-space:pre-wrap;">${escapeHtml(data.autoReplyIntro)}</p>
            <div style="margin:20px 0;padding:14px;background:#f8fafc;border-left:4px solid #0f172a;border-radius:4px;">
              <p style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong>Konu:</strong> ${escapeHtml(data.subject)}</p>
              <p style="margin:0;font-size:14px;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
            </div>
            <p style="margin-bottom:0;">Saygılarımızla,<br /><strong>${escapeHtml(data.storeName)}</strong></p>
          `,
        );

        await transporter.sendMail({
          from: fromHeader,
          to: sanitizeHeader(data.customerEmail),
          replyTo: replyToHeader,
          subject: autoSubject,
          text: `Merhaba ${data.customerName},\n\n${data.autoReplyIntro}\n\nKonu: ${data.subject}\nMesajınız:\n${data.message}\n\nSaygılarımızla,\n${data.storeName}`,
          html: htmlBody,
        });
        customerAutoReply = true;
      }

      return res.status(200).json({
        ok: true,
        sent: { storeNotification, customerAutoReply },
      });
    }

    // type === "reply"
    const replyData = parsed.data;
    if (!isValidEmail(replyData.customerEmail)) {
      return res.status(400).json({ error: "Geçersiz müşteri e-posta adresi." });
    }

    const replySubject = sanitizeHeader(
      `Re: ${replyData.originalSubject} — ${replyData.storeName}`,
    );
    const htmlBody = renderEmailShell(
      replyData.storeName,
      "Talebinize Yanıt",
      `
        <p>Merhaba <strong>${escapeHtml(replyData.customerName)}</strong>,</p>
        <p style="font-size:13px;color:#64748b;margin-bottom:16px;">Konu: <strong>${escapeHtml(replyData.originalSubject)}</strong></p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;white-space:pre-wrap;">${escapeHtml(replyData.replyMessage)}</div>
        <p style="margin-top:20px;margin-bottom:0;">Saygılarımızla,<br /><strong>${escapeHtml(replyData.storeName)}</strong></p>
      `,
    );

    await transporter.sendMail({
      from: fromHeader,
      to: sanitizeHeader(replyData.customerEmail),
      replyTo: replyToHeader,
      subject: replySubject,
      text: `Merhaba ${replyData.customerName},\n\nKonu: ${replyData.originalSubject}\n\n${replyData.replyMessage}\n\nSaygılarımızla,\n${replyData.storeName}`,
      html: htmlBody,
    });

    return res.status(200).json({
      ok: true,
      sent: { reply: true },
    });
  } catch (err: any) {
    console.error("[Contact Email] E-posta gönderimi başarısız:", err?.message || "unknown_error");
    return res.status(502).json({
      error: "E-posta gönderimi sırasında hata oluştu.",
    });
  }
};
