import { NextResponse } from "next/server";
import { getPayloadClient } from "../../../lib/payload/content";
import {
  checkContactRateLimit,
  contactSubmissionSchema,
  sendContactSubmissionEmails,
} from "../../../lib/contact/contact-service";
import { extractClientIp, requireAccountOrigin } from "../../../lib/security/origin-guard";

export async function POST(req: Request): Promise<NextResponse> {
  const originError = requireAccountOrigin(req);
  if (originError) {
    return originError;
  }

  const clientIp = extractClientIp(req);
  const rateKey = clientIp !== "unknown" ? `ip:${clientIp}` : "ip:local";
  const rateCheck = checkContactRateLimit(rateKey);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Çok fazla mesaj gönderdiniz. Lütfen biraz sonra tekrar deneyin." },
      {
        status: 429,
        headers: rateCheck.retryAfterSec
          ? { "Retry-After": String(rateCheck.retryAfterSec) }
          : undefined,
      },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  const parsed = contactSubmissionSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || "Lütfen tüm zorunlu alanları doldurun.";
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }

  const data = parsed.data;

  // Honeypot check
  if (data.website && data.website.trim().length > 0) {
    return NextResponse.json({ error: "Form gönderimi doğrulanamadı." }, { status: 400 });
  }

  try {
    const payload = await getPayloadClient();
    const siteSettings = (await payload.findGlobal({
      slug: "site-settings",
      depth: 0,
    })) as any;

    const contactSettings = siteSettings?.contactForm ?? {};
    if (contactSettings.enabled === false) {
      return NextResponse.json(
        { error: "İletişim formu şu anda geçici olarak kapalıdır." },
        { status: 503 },
      );
    }

    const created = await payload.create({
      collection: "contact-messages",
      overrideAccess: true,
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || "",
        subject: data.subject,
        message: data.message,
        kvkkAccepted: true,
        status: "new",
      },
    });

    const storeName = String(siteSettings?.storeName || "Mağaza");
    const recipientEmail =
      (typeof contactSettings.recipientEmail === "string" &&
        contactSettings.recipientEmail.trim()) ||
      (typeof siteSettings?.contactEmail === "string" && siteSettings.contactEmail.trim()) ||
      undefined;

    let emailSent = false;
    try {
      const mailRes = await sendContactSubmissionEmails({
        storeName,
        customerName: data.name,
        customerEmail: data.email,
        customerPhone: data.phone || undefined,
        subject: data.subject,
        message: data.message,
        recipientEmail,
        autoReplyEnabled: contactSettings.autoReplyEnabled !== false,
        autoReplySubject: String(contactSettings.autoReplySubject || "Mesajınızı aldık"),
        autoReplyIntro: String(
          contactSettings.autoReplyIntro ||
            "Mesajınız bize ulaştı. Ekibimiz talebinizi inceleyip en kısa sürede sizinle iletişime geçecektir.",
        ),
      });
      emailSent = Boolean(mailRes?.ok);
    } catch {
      // Do not log PII; submission is already persisted in contact-messages
      console.warn("[Contact API] İletişim e-postası gönderilemedi (mesaj kaydedildi).");
    }

    const successMessage = String(
      contactSettings.successMessage ||
        "Mesajınız başarıyla iletildi. En kısa sürede size dönüş yapacağız.",
    );

    return NextResponse.json(
      {
        ok: true,
        id: created.id,
        emailSent,
        message: successMessage,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Mesajınız kaydedilirken bir hata oluştu. Lütfen tekrar deneyin." },
      { status: 500 },
    );
  }
}
