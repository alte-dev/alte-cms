import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { ContactMessageService } from "../../../../modules/contact-message";
import { createTransporter } from "../../../../services/email-service";
import { dispatchSubmissionEmails } from "../../../../utils/contact-email-templates";

const createContactMessageSchema = z.object({
  storeName: z.string().min(1).max(120).default("Mağaza"),
  customerName: z.string().min(2).max(100),
  customerEmail: z.string().email().max(180),
  customerPhone: z.string().max(30).optional(),
  subject: z.string().min(2).max(150),
  message: z.string().min(10).max(5000),
  kvkkAccepted: z.literal(true),
  recipientEmail: z.string().email().max(180).optional(),
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

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const parsed = createContactMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Geçersiz iletişim formu verisi." });
  }

  const data = parsed.data;
  const service = req.scope.resolve<ContactMessageService>("contactMessageModuleService");

  const created = await service.createContactMessages({
    name: data.customerName,
    email: data.customerEmail,
    phone: data.customerPhone || null,
    subject: data.subject,
    message: data.message,
    kvkk_accepted: true,
    status: "new",
  });

  let emailSent = false;
  try {
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");
    const { transporter, settings } = await createTransporter(pgConnection);
    if (transporter && settings) {
      await dispatchSubmissionEmails(transporter, settings, data);
      emailSent = true;
    }
  } catch {
    console.warn("[Contact Messages] E-posta gönderilemedi (kayıt oluşturuldu).");
  }

  return res.status(201).json({
    ok: true,
    id: created.id,
    emailSent,
  });
};
