import { model } from "@medusajs/framework/utils";

export const CustomerSession = model.define("customer_session", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  token_hash: model.text().unique(),
  last_seen_at: model.dateTime(),
  expires_at: model.dateTime(),
  revoked_at: model.dateTime().nullable(),
});

export default CustomerSession;
