import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { validateCustomerPassword } from "../../../../../utils/password-policy";
import { z } from "zod";
import { hashToken, normalizeEmail } from "../../../../../modules/customer-account/helpers";
import { verifyJwtHs256 } from "../../../../middleware-guards";
import {
  clearNeedsPasswordUpgradeMetadata,
  getPgConnection,
  getTrustedClientIp,
  revokeAllCustomerSessions,
  tokenConfirmIpLimiter,
} from "../../_shared";

const confirmSchema = z.object({
  token: z.string().trim().min(10).max(2048),
  password: z.string().min(1).max(128),
});

const UNIFORM_TOKEN_ERROR = { error: "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş." };

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const clientIp = getTrustedClientIp(req);
  const ipDecision = tokenConfirmIpLimiter.consume(clientIp);
  if (!ipDecision.allowed) {
    return res.status(429).json({
      error: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyiniz.",
    });
  }

  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(UNIFORM_TOKEN_ERROR);
  }

  const { token, password } = parsed.data;

  const { http } = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig;
  const jwtSecret = String(http.jwtSecret || process.env.JWT_SECRET || "");
  const claims = verifyJwtHs256(token, jwtSecret) as
    | (ReturnType<typeof verifyJwtHs256> & { entity_id?: string; purpose?: string })
    | null;

  if (
    !claims ||
    claims.actor_type !== "customer" ||
    claims.purpose !== "reset" ||
    !claims.entity_id
  ) {
    return res.status(400).json(UNIFORM_TOKEN_ERROR);
  }

  const emailFromToken = normalizeEmail(claims.entity_id);
  const pwCheck = validateCustomerPassword(password, emailFromToken);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }

  const pgConnection = getPgConnection(req);
  const tokenHash = hashToken(token);
  const now = new Date();

  // 1. Validate reset token without consuming it yet (password update is external to pgConnection.transaction)
  const pendingToken = await pgConnection("customer_password_reset")
    .where({ token_hash: tokenHash })
    .whereNull("used_at")
    .whereNull("deleted_at")
    .andWhere("expires_at", ">", now)
    .select("customer_id")
    .first();

  if (!pendingToken?.customer_id) {
    return res.status(400).json(UNIFORM_TOKEN_ERROR);
  }

  const customerId = pendingToken.customer_id;
  const customer = await pgConnection("customer")
    .where({ id: customerId, has_account: true })
    .whereNull("deleted_at")
    .select("id", "email", "metadata")
    .first();

  if (!customer?.email || normalizeEmail(customer.email) !== emailFromToken) {
    return res.status(400).json(UNIFORM_TOKEN_ERROR);
  }

  // 2. Update password BEFORE consuming token so a failed password update never burns the token
  const authService = req.scope.resolve(Modules.AUTH);
  const email = normalizeEmail(customer.email);
  const existingProvider = await pgConnection("provider_identity")
    .where({ entity_id: email, provider: "emailpass" })
    .first();

  if (existingProvider) {
    const updateRes = await authService.updateProvider("emailpass", {
      entity_id: email,
      password,
    });
    if (!updateRes.success) {
      return res.status(400).json({ error: "Parola güncellenemedi." });
    }
  } else {
    const reg = await authService.register("emailpass", {
      url: req.url,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, string>,
      body: { email, password },
      protocol: req.protocol,
    });
    if (!reg.success || !reg.authIdentity) {
      return res.status(400).json({ error: "Parola güncellenemedi." });
    }
    await authService.updateAuthIdentities({
      id: reg.authIdentity.id,
      app_metadata: {
        ...(reg.authIdentity.app_metadata ?? {}),
        customer_id: customerId,
      },
    });
  }

  // 3. Atomically consume token, clear legacy credentials, and revoke all active sessions
  const tokenConsumed = await pgConnection.transaction(async (trx: any) => {
    const consumedRows = await trx("customer_password_reset")
      .where({ token_hash: tokenHash })
      .whereNull("used_at")
      .whereNull("deleted_at")
      .andWhere("expires_at", ">", now)
      .update({ used_at: now, updated_at: now })
      .returning(["customer_id"]);

    if (!consumedRows?.[0]?.customer_id) {
      return false;
    }

    await trx("customer_legacy_credential").where({ customer_id: customerId }).del();
    if (
      customer.metadata &&
      (customer.metadata as Record<string, unknown>).needs_password_upgrade
    ) {
      await trx("customer")
        .where({ id: customerId })
        .update({
          metadata: JSON.stringify(clearNeedsPasswordUpgradeMetadata(customer.metadata)),
          updated_at: now,
        });
    }
    await trx("customer_password_reset")
      .where({ customer_id: customerId })
      .whereNull("used_at")
      .update({ used_at: now, updated_at: now });
    await revokeAllCustomerSessions(trx, customerId);
    return true;
  });

  if (!tokenConsumed) {
    return res.status(400).json(UNIFORM_TOKEN_ERROR);
  }

  return res.status(200).json({
    ok: true,
    message: "Parolanız güncellendi. Yeni parolanızla giriş yapabilirsiniz.",
  });
};
