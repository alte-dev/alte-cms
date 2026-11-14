import crypto from "crypto";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  hashToken,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
} from "../modules/customer-account/helpers";
import { constantTimeCompare } from "../utils/crypto";

export interface JwtClaims {
  actor_id?: string;
  actor_type?: string;
  auth_identity_id?: string;
  exp?: number;
}

export function hasValidInternalSecret(req: { headers?: Record<string, unknown> }): boolean {
  const configured = process.env.INTERNAL_API_SECRET;
  if (!configured || configured.length < 32) {
    return false;
  }
  const provided = req.headers?.["x-alte-internal"];
  if (typeof provided !== "string" || !provided) {
    return false;
  }
  return constantTimeCompare(provided, configured);
}

export function extractBearerToken(req: { headers?: Record<string, unknown> }): string | null {
  const auth = req.headers?.authorization;
  if (typeof auth !== "string") return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() || null;
}

export function verifyJwtHs256(token: string, secret: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  try {
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    const actualSig = Buffer.from(sigB64, "base64url");
    if (expectedSig.length !== actualSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as JwtClaims;
    if (typeof claims.exp === "number" && Date.now() / 1000 >= claims.exp) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

function getPgConnection(req: any): any {
  try {
    return (
      req.scope?.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope?.resolve("__pg_connection__")
    );
  } catch {
    try {
      return req.scope?.resolve("__pg_connection__");
    } catch {
      return null;
    }
  }
}

export async function validateCustomerBearerSession(
  req: any,
): Promise<{ valid: boolean; actorId?: string; reason?: string }> {
  const token = extractBearerToken(req);
  if (!token) {
    return { valid: false, reason: "no_token" };
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return { valid: false, reason: "no_secret" };
  }

  const claims = verifyJwtHs256(token, jwtSecret);
  if (!claims || claims.actor_type !== "customer" || !claims.actor_id) {
    return { valid: false, reason: "not_customer_jwt" };
  }

  const pgConnection = getPgConnection(req);
  if (!pgConnection) {
    return { valid: false, reason: "no_db" };
  }

  const tokenHash = hashToken(token);
  const session = await pgConnection("customer_session")
    .where({ token_hash: tokenHash })
    .whereNull("deleted_at")
    .first();

  if (!session || session.revoked_at) {
    return { valid: false, reason: "revoked" };
  }

  const now = Date.now();
  const expiresAt = new Date(session.expires_at).getTime();
  const lastSeenAt = new Date(session.last_seen_at).getTime();
  if (Number.isNaN(expiresAt) || expiresAt <= now) {
    return { valid: false, reason: "expired" };
  }
  if (Number.isNaN(lastSeenAt) || now - lastSeenAt > SESSION_IDLE_TTL_MS) {
    return { valid: false, reason: "idle_expired" };
  }

  if (now - lastSeenAt >= SESSION_TOUCH_INTERVAL_MS) {
    try {
      await pgConnection("customer_session")
        .where({ id: session.id })
        .update({ last_seen_at: new Date(now), updated_at: new Date(now) });
    } catch {
      // Non-fatal touch error
    }
  }

  return { valid: true, actorId: claims.actor_id };
}

export function requireInternalSecret(req: any, res: any, next: () => void) {
  if (!hasValidInternalSecret(req)) {
    return res.status(404).json({ message: "Not Found" });
  }
  return next();
}

export function blockRoute(_req: any, res: any) {
  return res.status(404).json({ message: "Not Found" });
}

export async function customerSessionGuard(req: any, res: any, next: () => void) {
  const token = extractBearerToken(req);
  if (!token) {
    return next();
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const claims = verifyJwtHs256(token, jwtSecret);
  // Only enforce customer_session revocation for customer JWTs; admin user JWTs pass through
  if (claims && claims.actor_type !== "customer") {
    return next();
  }

  const check = await validateCustomerBearerSession(req);
  if (!check.valid) {
    return res.status(401).json({ message: "Oturum geçersiz veya süresi dolmuş." });
  }

  return next();
}

export async function blockCustomerTokenRefresh(req: any, res: any, next: () => void) {
  if (hasValidInternalSecret(req)) {
    return next();
  }
  const token = extractBearerToken(req);
  const jwtSecret = process.env.JWT_SECRET;
  if (token && jwtSecret) {
    const claims = verifyJwtHs256(token, jwtSecret);
    if (claims?.actor_type === "customer") {
      return res.status(404).json({ message: "Not Found" });
    }
  }
  return next();
}

export async function orderOwnershipGuard(req: any, res: any, next: () => void) {
  if (hasValidInternalSecret(req)) {
    return next();
  }

  const check = await validateCustomerBearerSession(req);
  if (!check.valid || !check.actorId) {
    return res.status(404).json({ message: "Not Found" });
  }

  const orderId = req.params?.id;
  if (!orderId) {
    return res.status(404).json({ message: "Not Found" });
  }

  const pgConnection = getPgConnection(req);
  if (!pgConnection) {
    return res.status(404).json({ message: "Not Found" });
  }

  const orderRow = await pgConnection("order")
    .where({ id: orderId, customer_id: check.actorId })
    .whereNull("deleted_at")
    .first();

  if (!orderRow) {
    return res.status(404).json({ message: "Not Found" });
  }

  return next();
}
