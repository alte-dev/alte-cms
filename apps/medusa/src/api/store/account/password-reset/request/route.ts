import { generateResetPasswordTokenWorkflow } from "@medusajs/core-flows";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { hashEmailLookup, normalizeEmail } from "../../../../../modules/customer-account/helpers";
import { waitTimingFloor } from "../../../../../utils/timing-floor";
import { getTrustedClientIp, resetEmailLimiter, resetIpLimiter } from "../../_shared";

const resetRequestSchema = z.object({
  email: z.string().trim().email().max(254),
});

const UNIFORM_RESET_RESPONSE = {
  ok: true,
  message:
    "Eğer bu e-posta adresine kayıtlı bir hesabınız varsa, şifre sıfırlama bağlantısı gönderildi.",
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const startMs = Date.now();
  const clientIp = getTrustedClientIp(req);

  const ipDecision = resetIpLimiter.consume(clientIp);
  if (!ipDecision.allowed) {
    return res.status(429).json({
      error: "Çok fazla şifre sıfırlama isteği gönderildi. Lütfen daha sonra tekrar deneyiniz.",
    });
  }

  const parsed = resetRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    await waitTimingFloor(startMs);
    return res.status(202).json(UNIFORM_RESET_RESPONSE);
  }

  const email = normalizeEmail(parsed.data.email);
  const emailDecision = resetEmailLimiter.consume(hashEmailLookup(email));
  if (!emailDecision.allowed) {
    return res.status(429).json({
      error:
        "Bu e-posta adresi için çok fazla şifre sıfırlama isteği gönderildi. Lütfen daha sonra tekrar deneyiniz.",
    });
  }

  const { http } = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE).projectConfig;

  await generateResetPasswordTokenWorkflow(req.scope).run({
    input: {
      entityId: email,
      actorType: "customer",
      provider: "emailpass",
      secret: http.jwtSecret,
      jwtOptions: http.jwtOptions,
    },
    throwOnError: false,
  });

  await waitTimingFloor(startMs);
  return res.status(202).json(UNIFORM_RESET_RESPONSE);
};
