import crypto from "crypto";
import { ContainerRegistrationKeys, generateJwtToken } from "@medusajs/framework/utils";
import {
  hashEmailLookup,
  hashToken,
  normalizeEmail,
  SESSION_ABSOLUTE_TTL_MS,
} from "../../../modules/customer-account/helpers";
import { BruteForceGuard, FixedWindowRateLimiter } from "../../../utils/rate-limiter";
import { verifyJwtHs256 } from "../../middleware-guards";

// Rate limiters (process-local; Redis migration planned for Faz 13)
export const loginIpEmailGuard = new BruteForceGuard({
  maxFailures: 5,
  blockDurationMs: 15 * 60_000,
});
export const loginIpLimiter = new FixedWindowRateLimiter({
  maxRequests: 30,
  windowMs: 15 * 60_000,
});
export const registerIpLimiter = new FixedWindowRateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60_000,
});
export const resetEmailLimiter = new FixedWindowRateLimiter({
  maxRequests: 3,
  windowMs: 60 * 60_000,
});
export const resetIpLimiter = new FixedWindowRateLimiter({
  maxRequests: 10,
  windowMs: 60 * 60_000,
});
export const tokenConfirmIpLimiter = new FixedWindowRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60_000,
});
export const resendVerificationCustomerLimiter = new FixedWindowRateLimiter({
  maxRequests: 3,
  windowMs: 60 * 60_000,
});

export function getPgConnection(req: any): any {
  return (
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
    req.scope.resolve("__pg_connection__")
  );
}

/**
 * Extracts client IP forwarded by the trusted Next.js BFF (verified via X-Alte-Internal).
 * Falls back to "unknown" (fail-closed single bucket).
 */
export function getTrustedClientIp(req: any): string {
  const forwarded = req.headers?.["x-alte-client-ip"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.trim().slice(0, 64);
  }
  return "unknown";
}

export function hmacRateKey(ip: string, email: string): string {
  return `${ip}:${hashEmailLookup(email)}`;
}

export function getCustomerIdFromRequest(req: any): string | null {
  const auth = req.headers?.authorization;
  if (typeof auth !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!match?.[1]) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  const claims = verifyJwtHs256(match[1].trim(), secret);
  if (!claims || claims.actor_type !== "customer" || !claims.actor_id) {
    return null;
  }
  return claims.actor_id;
}

export async function findRegisteredCustomerByEmail(pgConnection: any, email: string) {
  const normalized = normalizeEmail(email);
  return pgConnection("customer")
    .whereRaw("LOWER(email) = ?", [normalized])
    .andWhere("has_account", true)
    .whereNull("deleted_at")
    .first();
}

export async function issueCustomerSession(
  req: any,
  customerId: string,
  authIdentityId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE);
  const { http } = config.projectConfig;
  const pgConnection = getPgConnection(req);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS);

  const token = generateJwtToken(
    {
      actor_id: customerId,
      actor_type: "customer",
      auth_identity_id: authIdentityId,
      auth_provider: "emailpass",
      mfa_enabled: false,
      mfa_challenge_completed_at: null,
      app_metadata: {
        customer_id: customerId,
      },
      user_metadata: {},
    },
    {
      secret: http.jwtSecret,
      expiresIn: "7d",
      jwtOptions: {
        ...http.jwtOptions,
        jwtid: crypto.randomUUID(),
      },
    },
  );

  await pgConnection("customer_session").insert({
    id: `csess_${crypto.randomUUID().replace(/-/g, "")}`,
    customer_id: customerId,
    token_hash: hashToken(token),
    last_seen_at: now,
    expires_at: expiresAt,
    revoked_at: null,
    created_at: now,
    updated_at: now,
  });

  return { token, expiresAt };
}

export async function revokeAllCustomerSessions(
  pgConnection: any,
  customerId: string,
): Promise<void> {
  const now = new Date();
  await pgConnection("customer_session")
    .where({ customer_id: customerId })
    .whereNull("revoked_at")
    .update({ revoked_at: now, updated_at: now });
}
