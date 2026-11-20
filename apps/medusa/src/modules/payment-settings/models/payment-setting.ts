import { model } from "@medusajs/framework/utils";

export const PaymentSetting = model.define("payment_setting", {
  id: model.id().primaryKey(),
  paytr_enabled: model.boolean().default(false),
  paytr_mode: model.text().default("sandbox"), // "sandbox" | "live"
  paytr_merchant_id: model.text().nullable(),
  paytr_merchant_key: model.text().nullable(), // Encrypted with AES-256-GCM
  paytr_merchant_salt: model.text().nullable(), // Encrypted with AES-256-GCM
  paytr_display_mode: model.text().default("iframe"), // "iframe" | "redirect"
  paytr_no_installment: model.boolean().default(false),
  paytr_max_installment: model.number().default(0), // 0 or 2-12
  paytr_timeout_limit: model.number().default(30), // minutes
  paytr_lang: model.text().default("tr"), // "tr" | "en"
  iyzico_enabled: model.boolean().default(false),
  iyzico_mode: model.text().default("sandbox"), // "sandbox" | "live"
  iyzico_api_key: model.text().nullable(), // Encrypted with AES-256-GCM
  iyzico_secret_key: model.text().nullable(), // Encrypted with AES-256-GCM
  iyzico_display_mode: model.text().default("redirect"), // "redirect" | "embedded"
  iyzico_max_installment: model.number().default(1), // 1..12
  iyzico_lang: model.text().default("tr"), // "tr" | "en"
  iyzico_footer_logo_variant: model.text().default("colored"), // "colored" | "white"
  default_payment_method: model.text().nullable(), // "paytr" | "iyzico" | "cod" | null
  cod_enabled: model.boolean().default(false),
  cod_fee: model.number().default(100), // TL including tax
  cod_fee_label: model.text().default("Kapıda Ödeme Hizmet Bedeli"),
  cod_max_order_amount: model.number().nullable(), // null = unlimited
});

export default PaymentSetting;
