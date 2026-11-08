import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { PaymentSettingsRegistry } from "../../../modules/payment-settings/service";

/**
 * GET /store/payment-options
 * Returns safe public configuration for storefront payment methods.
 * No sensitive secrets or credentials are ever exposed here.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  let settings = PaymentSettingsRegistry.get();

  if (!settings) {
    try {
      const paymentSettingsService = req.scope.resolve<any>("paymentSettingsModuleService");
      settings = await paymentSettingsService.getDecryptedSettings();
    } catch {
      // fallback if service unresolvable
    }
  }

  const isDevAllowed =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_PAYMENT === "true";

  res.status(200).json({
    paytr: {
      enabled: settings ? settings.paytr_enabled : false,
      display_mode: settings?.paytr_display_mode || "iframe",
    },
    cod: {
      enabled: settings ? settings.cod_enabled : true,
      fee: settings?.cod_fee ?? 10000, // 100 TL in kuruş
      fee_label: settings?.cod_fee_label || "Kapıda Ödeme Hizmet Bedeli",
      max_order_amount: settings?.cod_max_order_amount ?? null,
    },
    dev: {
      enabled: isDevAllowed,
    },
  });
}
