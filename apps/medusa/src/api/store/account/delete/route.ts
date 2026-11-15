import crypto from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { z } from "zod";
import { normalizeEmail } from "../../../../modules/customer-account/helpers";
import {
  getCustomerIdFromRequest,
  getPgConnection,
  passwordVerifyCooldownGuard,
  recordPasswordVerifyFailureAndMaybeRevoke,
  resetPasswordVerifyGuards,
  revokeAllCustomerSessions,
} from "../_shared";

const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
  confirmation: z.literal("SİL", {
    message: 'Hesabınızı silmek için onay alanına "SİL" yazmalısınız.',
  }),
});

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = getCustomerIdFromRequest(req);
  if (!customerId) {
    return res.status(401).json({ error: "Oturum açmanız gerekiyor." });
  }

  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Doğrulama bilgileri eksik.",
    });
  }

  const pgConnection = getPgConnection(req);
  const customer = await pgConnection("customer")
    .where({ id: customerId, has_account: true })
    .whereNull("deleted_at")
    .select("id", "email")
    .first();

  if (!customer?.email) {
    return res.status(401).json({ error: "Oturum geçersiz." });
  }

  const cooldownDecision = passwordVerifyCooldownGuard.check(customerId);
  if (!cooldownDecision.allowed) {
    const revoked = await recordPasswordVerifyFailureAndMaybeRevoke(pgConnection, customerId);
    return res.status(429).json({
      error: revoked
        ? "Çok fazla hatalı parola denemesi nedeniyle oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın."
        : `Çok fazla hatalı parola denemesi. Lütfen ${cooldownDecision.remainingMinutes} dakika sonra tekrar deneyin.`,
    });
  }

  const email = normalizeEmail(customer.email);
  const authService = req.scope.resolve(Modules.AUTH);

  // Verify password before irreversible anonymization
  const verifyAuth = await authService.authenticate("emailpass", {
    url: req.url,
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, string>,
    body: { email, password: parsed.data.password },
    protocol: req.protocol,
  });

  if (!verifyAuth.success || !verifyAuth.authIdentity) {
    await recordPasswordVerifyFailureAndMaybeRevoke(pgConnection, customerId);
    return res.status(401).json({ error: "Parola hatalı." });
  }

  resetPasswordVerifyGuards(customerId);

  const now = new Date();
  const anonSuffix = crypto.randomBytes(8).toString("hex");
  const anonEmail = `deleted-${anonSuffix}@anonymized.invalid`;

  // Atomic KVKK anonymization, identity removal, and session revocation
  await pgConnection.transaction(async (trx: any) => {
    // 1. Anonymize registered customer record (keep row for financial/order referential integrity)
    await trx("customer").where({ id: customerId }).update({
      email: anonEmail,
      first_name: "Silinmiş",
      last_name: "Kullanıcı",
      phone: null,
      company_name: null,
      has_account: false,
      updated_at: now,
    });

    // Delete saved customer addresses
    await trx("customer_address").where({ customer_id: customerId }).del();

    // 2. Anonymize any guest customer records sharing the same email
    const guestCustomers: Array<{ id: string }> = await trx("customer")
      .whereRaw("LOWER(email) = ?", [email])
      .andWhere("has_account", false)
      .whereNot("id", customerId)
      .select("id");

    for (const guest of guestCustomers) {
      const gSuffix = crypto.randomBytes(8).toString("hex");
      await trx("customer")
        .where({ id: guest.id })
        .update({
          email: `deleted-${gSuffix}@anonymized.invalid`,
          first_name: "Silinmiş",
          last_name: "Kullanıcı",
          phone: null,
          company_name: null,
          updated_at: now,
        });
      await trx("customer_address").where({ customer_id: guest.id }).del();
    }

    // 3. Delete auth identity & provider identity so login is permanently impossible
    await trx("provider_identity").where({ auth_identity_id: verifyAuth.authIdentity!.id }).del();
    await trx("auth_identity").where({ id: verifyAuth.authIdentity!.id }).del();

    // 4. Revoke all sessions, delete verification/reset tokens & legacy credentials (keep consent audit rows)
    await revokeAllCustomerSessions(trx, customerId);
    await trx("customer_email_verification").where({ customer_id: customerId }).del();
    await trx("customer_password_reset").where({ customer_id: customerId }).del();
    await trx("customer_legacy_credential").where({ customer_id: customerId }).del();
  });

  return res.status(200).json({
    ok: true,
    message: "Hesabınız ve kişisel verileriniz kalıcı olarak anonimleştirildi.",
  });
};
