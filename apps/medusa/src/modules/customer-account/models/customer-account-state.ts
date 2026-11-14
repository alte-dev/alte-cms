import { model } from "@medusajs/framework/utils";

export const CustomerAccountState = model.define("customer_account_state", {
  id: model.id().primaryKey(),
  customer_id: model.text().unique(),
  email_verified_at: model.dateTime().nullable(),
});

export default CustomerAccountState;
