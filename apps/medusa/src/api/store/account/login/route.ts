import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import { z } from "zod";
import {
  decryptLegacyHash,
  hashEmailLookup,
  linkGuestOrdersForVerifiedCustomer,
  normalizeEmail,
} from "../../../../modules/customer-account/helpers";
import { defaultLegacyVerifierRegistry } from "../../../../modules/customer-account/verifiers/registry";
import { dummyScryptWork, waitTimingFloor } from "../../../../utils/timing-floor";
import {
  findRegisteredCustomerByEmail,
  getPgConnection,
  getTrustedClientIp,
  hmacRateKey,
  issueCustomerSession,
  loginIpEmailGuard,
  loginIpLimiter,
} from "../_shared";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

const UNIFORM_LOGIN_ERROR = { error: "E-posta veya parola hatalı." };

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const startMs = Date.now();
  const clientIp = getTrustedClientIp(req);

  const ipDecision = loginIpLimiter.consume(clientIp);
  if (!ipDecision.allowed) {
    return res.status(429).json({
      error: "Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyiniz.",
    });
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    await waitTimingFloor(startMs);
    return res.status(401).json(UNIFORM_LOGIN_ERROR);
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;
  const rateKey = hmacRateKey(clientIp, email);

  const bruteCheck = loginIpEmailGuard.check(rateKey);
  if (!bruteCheck.allowed) {
    return res.status(429).json({
      error: `Çok fazla hatalı giriş denemesi yapıldı. Lütfen ${bruteCheck.remainingMinutes} dakika sonra tekrar deneyiniz.`,
    });
  }

  const pgConnection = getPgConnection(req);
  const authService = req.scope.resolve(Modules.AUTH);

  let authenticatedCustomerId: string | null = null;
  let authenticatedAuthIdentityId: string | null = null;

  // 1. Primary verifier: Medusa emailpass
  const authResult = await authService.authenticate("emailpass", {
    url: req.url,
    headers: req.headers as Record<string, string>,
    query: req.query as Record<string, string>,
    body: { email, password },
    protocol: req.protocol,
  });

  if (authResult.success && authResult.authIdentity) {
    const cid = authResult.authIdentity.app_metadata?.customer_id;
    if (typeof cid === "string" && cid.length > 0) {
      const cust = await pgConnection("customer")
        .where({ id: cid, has_account: true })
        .whereNull("deleted_at")
        .first();
      if (cust) {
        authenticatedCustomerId = cid;
        authenticatedAuthIdentityId = authResult.authIdentity.id;
      }
    }
  }

  // 2. Fallback verifier list: Legacy WooCommerce hash (Faz 10 hook)
  if (!authenticatedCustomerId) {
    const emailLookup = hashEmailLookup(email);
    const legacyRow = await pgConnection("customer_legacy_credential")
      .where({ email_lookup: emailLookup })
      .whereNull("deleted_at")
      .first();

    if (legacyRow && defaultLegacyVerifierRegistry.has(legacyRow.algorithm)) {
      let matched = false;
      try {
        const plainLegacyHash = decryptLegacyHash(legacyRow.hash_encrypted);
        matched = await defaultLegacyVerifierRegistry.verify(
          legacyRow.algorithm,
          password,
          plainLegacyHash,
        );
      } catch {
        matched = false;
      }

      if (matched) {
        const customer = await findRegisteredCustomerByEmail(pgConnection, email);
        if (customer && customer.id === legacyRow.customer_id) {
          // Migrate password to Medusa emailpass and delete legacy credential
          let authIdentityId: string | null = null;
          const existingProvider = await pgConnection("provider_identity")
            .where({ entity_id: email, provider: "emailpass" })
            .first();

          if (existingProvider) {
            const updated = await authService.updateProvider("emailpass", {
              entity_id: email,
              password,
            });
            if (updated.success && updated.authIdentity) {
              authIdentityId = updated.authIdentity.id;
            }
          } else {
            const reg = await authService.register("emailpass", {
              url: req.url,
              headers: req.headers as Record<string, string>,
              query: req.query as Record<string, string>,
              body: { email, password },
              protocol: req.protocol,
            });
            if (reg.success && reg.authIdentity) {
              await authService.updateAuthIdentities({
                id: reg.authIdentity.id,
                app_metadata: {
                  ...(reg.authIdentity.app_metadata ?? {}),
                  customer_id: customer.id,
                },
              });
              authIdentityId = reg.authIdentity.id;
            }
          }

          if (authIdentityId) {
            // Must delete legacy credential; if delete fails, fail login
            const deletedCount = await pgConnection("customer_legacy_credential")
              .where({ id: legacyRow.id })
              .del();
            if (deletedCount > 0) {
              authenticatedCustomerId = customer.id;
              authenticatedAuthIdentityId = authIdentityId;
            }
          }
        }
      }
    } else if (!authResult.success) {
      // Equalize CPU work when account does not exist
      await dummyScryptWork(password);
    }
  }

  if (!authenticatedCustomerId || !authenticatedAuthIdentityId) {
    loginIpEmailGuard.recordFailure(rateKey);
    await waitTimingFloor(startMs);
    return res.status(401).json(UNIFORM_LOGIN_ERROR);
  }

  loginIpEmailGuard.clear(rateKey);
  const { token, expiresAt } = await issueCustomerSession(
    req,
    authenticatedCustomerId,
    authenticatedAuthIdentityId,
  );

  // Merge any guest orders placed after verification (no-op if unverified)
  await linkGuestOrdersForVerifiedCustomer(pgConnection, authenticatedCustomerId, email).catch(
    () => null,
  );

  await waitTimingFloor(startMs);
  return res.status(200).json({
    token,
    expires_at: expiresAt.toISOString(),
  });
};
