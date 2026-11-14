import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { validateCustomerPassword } from "../../../../../utils/password-policy";
import { z } from "zod";
import { hashToken, normalizeEmail } from "../../../../../modules/customer-account/helpers";
import { verifyJwtHs256 } from "../../../../middleware-guards";
import {
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

  if (!claims || claims.actor_type !== "customer" || claims.purpose !== "reset" || !claims.entity_id) {
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

  // Atomic single-use consumption
  const consumedRows = await pgConnection("customer_password_reset")
    .where({ token_hash: tokenHash })
    .whereNull("used_at")
    .whereNull("deleted_at")
    .andWhere("expires_at", ">", now)
    .update({ used_at: now, updated_at: now })
    .returning(["customer_id"]);

  const consumed = consumedRows?.[0];
  if (!consumed?.customer_id) {
    return res.status(400).json(UNIFORM_TOKEN_ERROR);
  }

  const customerId = consumed.customer_id;
  const customer = await pgConnection("customer")
    .where({ id: customerId, has_account: true })
    .whereNull("deleted_at")
    .select("id", "email")
    .first();

  if (!customer?.email || normalizeEmail(customer.email) !== emailFromToken) {
    return res.status(400).json(UNIFORM_TOKEN_ERROR);
  }

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

  // Delete any legacy credential and invalidate all other reset tokens & all active sessions
  await pgConnection("customer_legacy_credential").where({ customer_id: customerId }).del();
  await pgConnection("customer_password_reset")
    .where({ customer_id: customerId })
    .whereNull("used_at")
    .update({ used_at: now, updated_at: now });
  await revokeAllCustomerSessions(pgConnection, customerId);

  return res.status(200).json({
    ok: true,
    message: "Parolanız güncellendi. Yeni parolanızla giriş yapabilirsiniz.",
  });
};
