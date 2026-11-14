import { model } from "@medusajs/framework/utils";

export const CustomerConsent = model.define("customer_consent", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  consent_type: model.text(), // "kvkk_notice" | "marketing"
  granted: model.boolean(),
  document_version: model.text(),
});

export default CustomerConsent;
