import { model } from "@medusajs/framework/utils";

export const CustomerLegacyCredential = model.define("customer_legacy_credential", {
  id: model.id().primaryKey(),
  customer_id: model.text().unique(),
  email_lookup: model.text().unique(), // HMAC-SHA256(normalized email)
  algorithm: model.text(),
  hash_encrypted: model.text(), // AES-256-GCM encrypted legacy hash
});

export default CustomerLegacyCredential;
