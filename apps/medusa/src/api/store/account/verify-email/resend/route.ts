import crypto from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { z } from "zod";
import {
  EMAIL_VERIFICATION_OTP_TTL_MS,
  generateEmailOtp,
  hashEmailLookup,
  hashEmailOtp,
  normalizeEmail,
} from "../../../../../modules/customer-account/helpers";
import { waitTimingFloor } from "../../../../../utils/timing-floor";
import {
  findRegisteredCustomerByEmail,
  getCustomerIdFromRequest,
  getPgConnection,
  otpVerifyEmailGuard,
  resendVerificationCustomerLimiter,
  resendVerificationEmailLimiter,
} from "../../_shared";

const resendBodySchema = z.object({
  email: z.string().trim().email().max(254).optional(),
});

const UNIFORM_RESEND_RESPONSE = {
  ok: true,
  message: "Eğer hesabınız doğrulanmamışsa yeni 6 haneli doğrulama kodu gönderildi.",
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const startMs = Date.now();
  const pgConnection = getPgConnection(req);
  const authenticatedCustomerId = getCustomerIdFromRequest(req);

  let customer: { id: string; email: string; first_name?: string | null } | null = null;

  if (authenticatedCustomerId) {
    const decision = resendVerificationCustomerLimiter.consume(authenticatedCustomerId);
    if (!decision.allowed) {
      return res.status(429).json({
        error: "Doğrulama e-postası çok sık istendi. Lütfen daha sonra tekrar deneyiniz.",
      });
    }
    customer = await pgConnection("customer")
      .where({ id: authenticatedCustomerId, has_account: true })
      .whereNull("deleted_at")
      .select("id", "email", "first_name")
      .first();

    if (!customer?.email) {
      return res.status(404).json({ error: "Hesap bulunamadı." });
    }
  } else {
    const parsed = resendBodySchema.safeParse(req.body ?? {});
    if (!parsed.success || !parsed.data.email) {
      return res.status(401).json({ error: "Oturum açmanız veya e-posta belirtmeniz gerekiyor." });
    }
    const email = normalizeEmail(parsed.data.email);
    const emailRateKey = hashEmailLookup(email);
    const decision = resendVerificationEmailLimiter.consume(emailRateKey);
    if (!decision.allowed) {
      return res.status(429).json({
        error: "Doğrulama e-postası çok sık istendi. Lütfen daha sonra tekrar deneyiniz.",
      });
    }
    customer = await findRegisteredCustomerByEmail(pgConnection, email);
    if (!customer?.email) {
      await waitTimingFloor(startMs);
      return res.status(202).json(UNIFORM_RESEND_RESPONSE);
    }
  }

  const state = await pgConnection("customer_account_state")
    .where({ customer_id: customer.id })
    .first();

  if (state?.email_verified_at) {
    if (authenticatedCustomerId) {
      return res.status(200).json({ ok: true, already_verified: true });
    }
    await waitTimingFloor(startMs);
    return res.status(202).json(UNIFORM_RESEND_RESPONSE);
  }

  const now = new Date();
  const email = normalizeEmail(customer.email);
  await pgConnection("customer_email_verification")
    .where({ customer_id: customer.id })
    .whereNull("used_at")
    .update({ used_at: now, updated_at: now });

  const otp = generateEmailOtp();
  const tokenHash = hashEmailOtp(email, otp);
  await pgConnection("customer_email_verification").insert({
    id: `cver_${crypto.randomUUID().replace(/-/g, "")}`,
    customer_id: customer.id,
    token_hash: tokenHash,
    expires_at: new Date(now.getTime() + EMAIL_VERIFICATION_OTP_TTL_MS),
    used_at: null,
    created_at: now,
    updated_at: now,
  });

  otpVerifyEmailGuard.clear(hashEmailLookup(email));

  const eventBus = req.scope.resolve(Modules.EVENT_BUS);
  await eventBus.emit({
    name: "customer_account.verification_requested",
    data: {
      customer_id: customer.id,
      email,
      first_name: customer.first_name || "",
      otp,
    },
  });

  if (!authenticatedCustomerId) {
    await waitTimingFloor(startMs);
    return res.status(202).json(UNIFORM_RESEND_RESPONSE);
  }

  return res.status(202).json({
    ok: true,
    message: "Doğrulama kodu e-posta adresinize gönderildi.",
  });
};
