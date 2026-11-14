import crypto from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import {
  EMAIL_VERIFICATION_TTL_MS,
  generateOpaqueToken,
} from "../../../../../modules/customer-account/helpers";
import {
  getCustomerIdFromRequest,
  getPgConnection,
  resendVerificationCustomerLimiter,
} from "../../_shared";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = getCustomerIdFromRequest(req);
  if (!customerId) {
    return res.status(401).json({ error: "Oturum açmanız gerekiyor." });
  }

  const decision = resendVerificationCustomerLimiter.consume(customerId);
  if (!decision.allowed) {
    return res.status(429).json({
      error: "Doğrulama e-postası çok sık istendi. Lütfen daha sonra tekrar deneyiniz.",
    });
  }

  const pgConnection = getPgConnection(req);
  const state = await pgConnection("customer_account_state")
    .where({ customer_id: customerId })
    .first();

  if (state?.email_verified_at) {
    return res.status(200).json({ ok: true, already_verified: true });
  }

  const customer = await pgConnection("customer")
    .where({ id: customerId, has_account: true })
    .whereNull("deleted_at")
    .select("id", "email")
    .first();

  if (!customer?.email) {
    return res.status(404).json({ error: "Hesap bulunamadı." });
  }

  const now = new Date();
  await pgConnection("customer_email_verification")
    .where({ customer_id: customerId })
    .whereNull("used_at")
    .update({ used_at: now, updated_at: now });

  const { raw: rawToken, hash: tokenHash } = generateOpaqueToken();
  await pgConnection("customer_email_verification").insert({
    id: `cver_${crypto.randomUUID().replace(/-/g, "")}`,
    customer_id: customerId,
    token_hash: tokenHash,
    expires_at: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
    used_at: null,
    created_at: now,
    updated_at: now,
  });

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({
    name: "customer_account.verification_requested",
    data: {
      customer_id: customerId,
      email: customer.email,
      token: rawToken,
    },
  });

  return res.status(202).json({
    ok: true,
    message: "Doğrulama bağlantısı e-posta adresinize gönderildi.",
  });
};
