import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
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

  // Lookup variant ID for SERVICE-COD-FEE
  let codVariantId: string | null = null;
  try {
    const productService = req.scope.resolve(Modules.PRODUCT);
    const variants = await productService.listProductVariants({ sku: "SERVICE-COD-FEE" });
    if (variants && variants.length > 0) {
      codVariantId = variants[0].id;
    }
  } catch {
    // handled gracefully
  }

  const isDevAllowed =
    process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_PAYMENT === "true";

  res.status(200).json({
    paytr: {
      enabled: settings ? settings.paytr_enabled : false,
      display_mode: settings?.paytr_display_mode || "iframe",
    },
    cod: {
      enabled: settings ? settings.cod_enabled : false, // Fail-closed default: false
      fee: settings?.cod_fee ?? 100, // Standard TL currency unit
      fee_label: settings?.cod_fee_label || "Kapıda Ödeme Hizmet Bedeli",
      max_order_amount: settings?.cod_max_order_amount ?? null,
      variant_id: codVariantId,
    },
    dev: {
      enabled: isDevAllowed,
    },
  });
}
