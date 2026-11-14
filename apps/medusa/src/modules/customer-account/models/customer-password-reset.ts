import { model } from "@medusajs/framework/utils";

export const CustomerPasswordReset = model.define("customer_password_reset", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  token_hash: model.text().unique(),
  expires_at: model.dateTime(),
  used_at: model.dateTime().nullable(),
});

export default CustomerPasswordReset;
