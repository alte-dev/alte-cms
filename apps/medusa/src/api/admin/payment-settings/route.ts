import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import PaymentSettingsService from "../../../modules/payment-settings/service";

const updatePaymentSettingsSchema = z.object({
  paytr_enabled: z.boolean().optional(),
  paytr_mode: z.enum(["sandbox", "live"]).optional(),
  paytr_merchant_id: z.string().optional(),
  paytr_merchant_key: z.string().optional(),
  paytr_merchant_salt: z.string().optional(),
  paytr_display_mode: z.enum(["iframe", "redirect"]).optional(),
  paytr_no_installment: z.boolean().optional(),
  paytr_max_installment: z
    .number()
    .int()
    .refine((v) => v === 0 || (v >= 2 && v <= 12), {
      message: "Maksimum taksit sayısı 0 (sınırsız) veya 2 ile 12 arasında olmalıdır.",
    })
    .optional(),
  paytr_timeout_limit: z
    .number()
    .int()
    .min(5, "Zaman aşımı en az 5 dakika olmalıdır.")
    .max(120, "Zaman aşımı en fazla 120 dakika olabilir.")
    .optional(),
  paytr_lang: z.enum(["tr", "en"]).optional(),
  cod_enabled: z.boolean().optional(),
  cod_fee: z.number().min(0, "Kapıda ödeme bedeli negatif olamaz.").optional(),
  cod_fee_label: z.string().optional(),
  cod_max_order_amount: z.number().nullable().optional(),
  confirm_live: z.string().optional(),
});

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const service = req.scope.resolve<PaymentSettingsService>("paymentSettingsModuleService");
    const maskedSettings = await service.getMaskedSettings();
    return res.status(200).json({ settings: maskedSettings });
  } catch (err: any) {
    return res.status(500).json({
      error: `Ödeme ayarları yüklenirken hata oluştu: ${err.message}`,
    });
  }
};

export const PUT = async (req: MedusaRequest, res: MedusaResponse) => {
  const parseResult = updatePaymentSettingsSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    return res.status(400).json({
      error: `Geçersiz ayar verisi: ${errorMsg}`,
      details: parseResult.error.format(),
    });
  }

  try {
    const service = req.scope.resolve<PaymentSettingsService>("paymentSettingsModuleService");
    const adminUser = (req as any).user?.email || (req as any).user?.id || "admin";

    const updatedSettings = await service.updateSafeSettings(parseResult.data, adminUser);

    return res.status(200).json({
      success: true,
      message: "Ödeme ayarları başarıyla güncellendi.",
      settings: updatedSettings,
    });
  } catch (err: any) {
    return res.status(400).json({
      error: err.message || "Ödeme ayarları güncellenirken bir hata oluştu.",
    });
  }
};
