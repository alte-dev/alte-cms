import crypto from "crypto";
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

  // Mark account verified (upsert as an additional safeguard; never silently return 200 on 0 rows)
  const upsertResult = await pgConnection.raw(
    `INSERT INTO customer_account_state (id, customer_id, email_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (customer_id) DO UPDATE
     SET email_verified_at = COALESCE(customer_account_state.email_verified_at, EXCLUDED.email_verified_at),
         updated_at = EXCLUDED.updated_at
     RETURNING customer_id, email_verified_at`,
    [`cstate_${crypto.randomUUID().replace(/-/g, "")}`, customerId, now, now, now],
  );
  const upsertedState = upsertResult?.rows?.[0];
  if (!upsertedState?.customer_id || !upsertedState?.email_verified_at) {
    console.error(
      "[Account Verify Email] customer_account_state güncellenemedi (0 satır etkilendi).",
      {
        customerId,
      },
    );
    return res.status(500).json({ error: "E-posta doğrulama durumu güncellenemedi." });
  }

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
