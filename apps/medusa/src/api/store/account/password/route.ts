import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { validateCustomerPassword } from "../../../../utils/password-policy";
import { z } from "zod";
import { normalizeEmail } from "../../../../modules/customer-account/helpers";
import {
  getCustomerIdFromRequest,
  getPgConnection,
  issueCustomerSession,
  revokeAllCustomerSessions,
} from "../_shared";

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(128),
  new_password: z.string().min(1).max(128),
});

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const customerId = getCustomerIdFromRequest(req);
  if (!customerId) {
    return res.status(401).json({ error: "Oturum açmanız gerekiyor." });
  }

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Mevcut ve yeni parola zorunludur." });
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

  const email = normalizeEmail(customer.email);
  const pwCheck = validateCustomerPassword(parsed.data.new_password, email);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }

  const authService = req.scope.resolve(Modules.AUTH);
  const verifyCurrent = await authService.authenticate("emailpass", {
    url: req.url,
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, string>,
    body: { email, password: parsed.data.current_password },
    protocol: req.protocol,
  });

  if (!verifyCurrent.success || !verifyCurrent.authIdentity) {
    return res.status(401).json({ error: "Mevcut parola hatalı." });
  }

  const updateRes = await authService.updateProvider("emailpass", {
    entity_id: email,
    password: parsed.data.new_password,
  });
  if (!updateRes.success) {
    return res.status(400).json({ error: "Parola güncellenemedi." });
  }

  // Revoke all sessions, then issue a fresh session for the current device
  await revokeAllCustomerSessions(pgConnection, customerId);
  const { token, expiresAt } = await issueCustomerSession(
    req,
    customerId,
    verifyCurrent.authIdentity.id,
  );

  return res.status(200).json({
    ok: true,
    token,
    expires_at: expiresAt.toISOString(),
    message: "Parolanız güncellendi.",
  });
};
