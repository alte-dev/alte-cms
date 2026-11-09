import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { getMaskedEmailSettings, updateEmailSettings } from "../../../services/email-service";

const updateEmailSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  host: z.string().min(1, "SMTP sunucu adresi zorunludur.").optional(),
  port: z
    .number()
    .int()
    .min(1, "Port 1-65535 arasında olmalıdır.")
    .max(65535, "Port 1-65535 arasında olmalıdır.")
    .optional(),
  secure: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  from_name: z.string().min(1, "Gönderen adı boş olamaz.").optional(),
  from_email: z.string().email("Geçerli bir gönderen e-posta adresi giriniz.").optional(),
  reply_to: z
    .string()
    .email("Geçerli bir yanıt e-posta adresi giriniz.")
    .optional()
    .or(z.literal("")),
  admin_notify_email: z
    .string()
    .email("Geçerli bir yönetici bildirim e-posta adresi giriniz.")
    .optional()
    .or(z.literal("")),
});

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    const settings = await getMaskedEmailSettings(pgConnection);
    return res.status(200).json({ settings });
  } catch (err: any) {
    return res.status(500).json({
      error: `E-posta ayarları yüklenemedi: ${err.message}`,
    });
  }
};

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const parseResult = updateEmailSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    return res.status(400).json({
      error: `Geçersiz ayar verisi: ${errorMsg}`,
      details: parseResult.error.format(),
    });
  }

  try {
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    const adminUser = (req as any).user?.email || (req as any).user?.id || "admin";
    const updated = await updateEmailSettings(pgConnection, parseResult.data, adminUser);

    return res.status(200).json({
      message: "E-posta ayarları başarıyla kaydedildi.",
      settings: updated,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `E-posta ayarları güncellenirken hata oluştu: ${err.message}`,
    });
  }
};
