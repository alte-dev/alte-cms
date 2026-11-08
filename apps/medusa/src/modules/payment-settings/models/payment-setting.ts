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
  cod_enabled: model.boolean().default(false),
  cod_fee: model.number().default(100), // TL including tax
  cod_fee_label: model.text().default("Kapıda Ödeme Hizmet Bedeli"),
  cod_max_order_amount: model.number().nullable(), // null = unlimited
});

export default PaymentSetting;
