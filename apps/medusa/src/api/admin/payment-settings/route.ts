import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { z } from "zod";
import PaymentSettingsService from "../../../modules/payment-settings/service";
import { checkAdminSettingsRole } from "../../../utils/admin-role-guard";

export async function ensureEnabledProvidersLinkedToRegions(
  scope: MedusaRequest["scope"],
  settings: { paytr_enabled?: boolean; iyzico_enabled?: boolean; cod_enabled?: boolean },
): Promise<void> {
  const providersToEnsure: string[] = [];
  if (settings.paytr_enabled) providersToEnsure.push("pp_paytr_paytr");
  if (settings.iyzico_enabled) providersToEnsure.push("pp_iyzico_iyzico");
  if (settings.cod_enabled) providersToEnsure.push("pp_cod_cod");
  if (providersToEnsure.length === 0) return;

  try {
    const regionService = scope.resolve<any>(Modules.REGION);
    const remoteLink = scope.resolve<any>(ContainerRegistrationKeys.REMOTE_LINK);
    if (!regionService || !remoteLink) return;

    const regions = await regionService.listRegions({});
    for (const region of regions || []) {
      for (const providerId of providersToEnsure) {
        try {
          await remoteLink.create([
            {
              [Modules.REGION]: { region_id: region.id },
              [Modules.PAYMENT]: { payment_provider_id: providerId },
            },
          ]);
        } catch (linkErr: any) {
          const msg = String(linkErr?.message || "");
          if (!/already\s+exists|already\s+linked|duplicate|unique/i.test(msg)) {
            console.warn(
              `[Payment Settings] Bölge (${region.id}) sağlayıcı (${providerId}) bağlantısı oluşturulamadı:`,
              msg || linkErr,
            );
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("[Payment Settings] Bölge sağlayıcı bağlantısı kontrol edilemedi:", err?.message);
  }
}

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
  iyzico_enabled: z.boolean().optional(),
  iyzico_mode: z.enum(["sandbox", "live"]).optional(),
  iyzico_api_key: z.string().optional(),
  iyzico_secret_key: z.string().optional(),
  iyzico_display_mode: z.enum(["redirect", "embedded"]).optional(),
  iyzico_max_installment: z
    .number()
    .int()
    .min(1, "iyzico maksimum taksit sayısı en az 1 olmalıdır.")
    .max(12, "iyzico maksimum taksit sayısı en fazla 12 olabilir.")
    .optional(),
  iyzico_lang: z.enum(["tr", "en"]).optional(),
  default_payment_method: z.enum(["paytr", "iyzico", "cod"]).nullable().optional(),
  cod_enabled: z.boolean().optional(),
  cod_fee: z.number().min(0, "Kapıda ödeme bedeli negatif olamaz.").optional(),
  cod_fee_label: z.string().optional(),
  cod_max_order_amount: z.number().nullable().optional(),
  confirm_live: z.string().optional(),
});

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!(await checkAdminSettingsRole(req, res))) return;
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
  if (!(await checkAdminSettingsRole(req, res))) return;
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
    await ensureEnabledProvidersLinkedToRegions(req.scope, updatedSettings);

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
