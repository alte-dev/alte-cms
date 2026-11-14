import crypto from "crypto";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { validateCustomerPassword } from "../../../../utils/password-policy";
import { z } from "zod";
import {
  EMAIL_VERIFICATION_TTL_MS,
  generateOpaqueToken,
  normalizeEmail,
} from "../../../../modules/customer-account/helpers";
import { waitTimingFloor } from "../../../../utils/timing-floor";
import {
  findRegisteredCustomerByEmail,
  getPgConnection,
  getTrustedClientIp,
  registerIpLimiter,
} from "../_shared";

const registerSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi giriniz.").max(254),
  password: z.string().min(1).max(128),
  first_name: z.string().trim().min(1, "Ad zorunludur.").max(100),
  last_name: z.string().trim().min(1, "Soyad zorunludur.").max(100),
  phone: z.string().trim().max(30).optional().nullable(),
  kvkk_notice: z.literal(true, {
    message: "KVKK Aydınlatma Metnini onaylamanız zorunludur.",
  }),
  kvkk_version: z.string().trim().min(1).max(128),
  marketing_consent: z.boolean().optional().default(false),
  marketing_version: z.string().trim().min(1).max(128),
});

const UNIFORM_REGISTER_RESPONSE = {
  ok: true,
  message: "Kaydınız alındı. Devam etmek için e-posta adresinize gönderilen bağlantıyı kullanın.",
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const startMs = Date.now();
  const clientIp = getTrustedClientIp(req);

  const ipDecision = registerIpLimiter.consume(clientIp);
  if (!ipDecision.allowed) {
    return res.status(429).json({
      error: "Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyiniz.",
    });
  }

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || "Lütfen form alanlarını kontrol ediniz.",
    });
  }

  const data = parsed.data;
  const email = normalizeEmail(data.email);

  const pwCheck = validateCustomerPassword(data.password, email);
  if (!pwCheck.valid) {
    return res.status(400).json({ error: pwCheck.error });
  }

  const pgConnection = getPgConnection(req);
  const eventBus = req.scope.resolve(Modules.EVENT_BUS);

  const existing = await findRegisteredCustomerByEmail(pgConnection, email);
  if (existing) {
    try {
      await eventBus.emit({
        name: "customer_account.duplicate_register_attempt",
        data: { email, customer_id: existing.id },
      });
    } catch {
      // Non-fatal
    }
    await waitTimingFloor(startMs);
    return res.status(202).json(UNIFORM_REGISTER_RESPONSE);
  }

  const authService = req.scope.resolve(Modules.AUTH);
  const customerService = req.scope.resolve(Modules.CUSTOMER);

  const authResult = await authService.register("emailpass", {
    url: req.url,
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, string>,
    body: { email, password: data.password },
    protocol: req.protocol,
  });

  if (!authResult.success || !authResult.authIdentity) {
    // Race condition fallback: treat as duplicate without leaking
    await waitTimingFloor(startMs);
    return res.status(202).json(UNIFORM_REGISTER_RESPONSE);
  }

  const customer = await customerService.createCustomers({
    email,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone || undefined,
    has_account: true,
  });

  await authService.updateAuthIdentities({
    id: authResult.authIdentity.id,
    app_metadata: {
      ...(authResult.authIdentity.app_metadata ?? {}),
      customer_id: customer.id,
    },
  });

  const now = new Date();
  await pgConnection("customer_account_state").insert({
    id: `cstate_${crypto.randomUUID().replace(/-/g, "")}`,
    customer_id: customer.id,
    email_verified_at: null,
    created_at: now,
    updated_at: now,
  });

  await pgConnection("customer_consent").insert([
    {
      id: `ccons_${crypto.randomUUID().replace(/-/g, "")}`,
      customer_id: customer.id,
      consent_type: "kvkk_notice",
      granted: true,
      document_version: data.kvkk_version,
      created_at: now,
      updated_at: now,
    },
    {
      id: `ccons_${crypto.randomUUID().replace(/-/g, "")}`,
      customer_id: customer.id,
      consent_type: "marketing",
      granted: Boolean(data.marketing_consent),
      document_version: data.marketing_version,
      created_at: now,
      updated_at: now,
    },
  ]);

  const { raw: rawToken, hash: tokenHash } = generateOpaqueToken();
  await pgConnection("customer_email_verification").insert({
    id: `cver_${crypto.randomUUID().replace(/-/g, "")}`,
    customer_id: customer.id,
    token_hash: tokenHash,
    expires_at: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
    used_at: null,
    created_at: now,
    updated_at: now,
  });

  try {
    await eventBus.emit({
      name: "customer_account.verification_requested",
      data: {
        customer_id: customer.id,
        email,
        token: rawToken,
      },
    });
  } catch {
    // Non-fatal
  }

  await waitTimingFloor(startMs);
  return res.status(202).json(UNIFORM_REGISTER_RESPONSE);
};
