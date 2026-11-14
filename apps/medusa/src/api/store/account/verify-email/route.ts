import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import {
  hashToken,
  linkGuestOrdersForVerifiedCustomer,
} from "../../../../modules/customer-account/helpers";
import { getPgConnection, getTrustedClientIp, tokenConfirmIpLimiter } from "../_shared";

const verifySchema = z.object({
  token: z.string().trim().min(10).max(256),
});

const UNIFORM_VERIFY_ERROR = { error: "Bağlantı geçersiz veya süresi dolmuş." };

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const clientIp = getTrustedClientIp(req);
  const ipDecision = tokenConfirmIpLimiter.consume(clientIp);
  if (!ipDecision.allowed) {
    return res.status(429).json({
      error: "Çok fazla doğrulama denemesi yapıldı. Lütfen daha sonra tekrar deneyiniz.",
    });
  }

  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(UNIFORM_VERIFY_ERROR);
  }

  const pgConnection = getPgConnection(req);
  const tokenHash = hashToken(parsed.data.token);
  const now = new Date();

  // Atomic single-use consumption
  const consumedRows = await pgConnection("customer_email_verification")
    .where({ token_hash: tokenHash })
    .whereNull("used_at")
    .whereNull("deleted_at")
    .andWhere("expires_at", ">", now)
    .update({ used_at: now, updated_at: now })
    .returning(["customer_id"]);

  const consumed = consumedRows?.[0];
  if (!consumed?.customer_id) {
    return res.status(400).json(UNIFORM_VERIFY_ERROR);
  }

  const customerId = consumed.customer_id;

  // Mark account verified (idempotent if already verified)
  await pgConnection("customer_account_state")
    .where({ customer_id: customerId })
    .whereNull("email_verified_at")
    .update({ email_verified_at: now, updated_at: now });

  // Invalidate any other unused verification tokens for this customer
  await pgConnection("customer_email_verification")
    .where({ customer_id: customerId })
    .whereNull("used_at")
    .update({ used_at: now, updated_at: now });

  const customer = await pgConnection("customer")
    .where({ id: customerId, has_account: true })
    .whereNull("deleted_at")
    .select("id", "email")
    .first();

  let linkedOrders = 0;
  if (customer?.email) {
    const linkResult = await linkGuestOrdersForVerifiedCustomer(
      pgConnection,
      customerId,
      customer.email,
    );
    linkedOrders = linkResult.linkedCount;
  }

  return res.status(200).json({
    ok: true,
    linked_orders: linkedOrders,
    message: "E-posta adresiniz başarıyla doğrulandı.",
  });
};
