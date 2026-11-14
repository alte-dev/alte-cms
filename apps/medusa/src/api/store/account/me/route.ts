import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { getCustomerIdFromRequest, getPgConnection } from "../_shared";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = getCustomerIdFromRequest(req);
  if (!customerId) {
    return res.status(401).json({ error: "Oturum açmanız gerekiyor." });
  }

  const pgConnection = getPgConnection(req);
  const customer = await pgConnection("customer")
    .where({ id: customerId, has_account: true })
    .whereNull("deleted_at")
    .select("id", "email", "first_name", "last_name", "phone")
    .first();

  if (!customer) {
    return res.status(401).json({ error: "Oturum geçersiz." });
  }

  const state = await pgConnection("customer_account_state")
    .where({ customer_id: customerId })
    .select("email_verified_at")
    .first();

  return res.status(200).json({
    customer: {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      phone: customer.phone || "",
      email_verified: Boolean(state?.email_verified_at),
      email_verified_at: state?.email_verified_at || null,
    },
  });
};
