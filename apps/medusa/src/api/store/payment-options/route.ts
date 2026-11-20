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

  // Fail-closed: iyzico is only exposed when both enabled and credentials exist
  const iyzicoEnabled = Boolean(
    settings && settings.iyzico_enabled && settings.iyzico_api_key && settings.iyzico_secret_key,
  );
  const paytrEnabled = Boolean(
    settings &&
      settings.paytr_enabled &&
      settings.paytr_merchant_id &&
      settings.paytr_merchant_key &&
      settings.paytr_merchant_salt,
  );
  const codEnabled = Boolean(settings && settings.cod_enabled);

  const enabledMap = {
    iyzico: iyzicoEnabled,
    paytr: paytrEnabled,
    cod: codEnabled,
  };

  let defaultMethod: "iyzico" | "paytr" | "cod" | null = null;
  if (settings?.default_payment_method && enabledMap[settings.default_payment_method]) {
    defaultMethod = settings.default_payment_method;
  } else if (iyzicoEnabled) {
    defaultMethod = "iyzico";
  } else if (paytrEnabled) {
    defaultMethod = "paytr";
  } else if (codEnabled) {
    defaultMethod = "cod";
  }

  res.status(200).json({
    iyzico: {
      enabled: iyzicoEnabled,
      mode: settings?.iyzico_mode === "live" ? "live" : "sandbox",
      display_mode: settings?.iyzico_display_mode === "embedded" ? "embedded" : "redirect",
      footer_logo_variant: settings?.iyzico_footer_logo_variant === "white" ? "white" : "colored",
    },
    paytr: {
      enabled: paytrEnabled,
      display_mode: settings?.paytr_display_mode || "iframe",
    },
    cod: {
      enabled: codEnabled, // Fail-closed default: false
      fee: settings?.cod_fee ?? 100, // Standard TL currency unit
      fee_label: settings?.cod_fee_label || "Kapıda Ödeme Hizmet Bedeli",
      max_order_amount: settings?.cod_max_order_amount ?? null,
      variant_id: codVariantId,
    },
    default_method: defaultMethod,
    dev: {
      enabled: isDevAllowed,
    },
  });
}
