import { model } from "@medusajs/framework/utils";

export const CustomerEmailVerification = model.define("customer_email_verification", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  token_hash: model.text().unique(),
  expires_at: model.dateTime(),
  used_at: model.dateTime().nullable(),
});

export default CustomerEmailVerification;
