import crypto from "crypto";
import { decryptSetting, encryptSetting, parseEncryptionKey } from "../../utils/crypto";

export const SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const SESSION_IDLE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes (matches Medusa RESET_PASSWORD_TOKEN_TTL_SECONDS)

export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmailLookup(email: string, rawEncryptionKey?: string): string {
  const keyBuf = parseEncryptionKey(rawEncryptionKey ?? process.env.SETTINGS_ENCRYPTION_KEY);
  return crypto.createHmac("sha256", keyBuf).update(normalizeEmail(email), "utf8").digest("hex");
}

export function encryptLegacyHash(legacyHash: string, rawEncryptionKey?: string): string {
  const keyBuf = parseEncryptionKey(rawEncryptionKey ?? process.env.SETTINGS_ENCRYPTION_KEY);
  return encryptSetting(legacyHash, keyBuf);
}

export function decryptLegacyHash(encryptedHash: string, rawEncryptionKey?: string): string {
  const keyBuf = parseEncryptionKey(rawEncryptionKey ?? process.env.SETTINGS_ENCRYPTION_KEY);
  return decryptSetting(encryptedHash, keyBuf);
}

/**
 * Faz 10 hook: directly links imported orders to a customer account.
 */
export async function linkOrdersToCustomer(
  pgConnection: any,
  customerId: string,
  orderIds: string[],
): Promise<number> {
  if (!customerId || orderIds.length === 0) return 0;
  return pgConnection("order").whereIn("id", orderIds).update({
    customer_id: customerId,
    updated_at: new Date(),
  });
}

/**
 * Links guest orders (`has_account = false`) matching `email` to `customerId`,
 * ONLY if the account's `email_verified_at` is non-null (fail-closed).
 */
export async function linkGuestOrdersForVerifiedCustomer(
  pgConnection: any,
  customerId: string,
  email: string,
): Promise<{ linkedCount: number; skippedUnverified: boolean }> {
  const state = await pgConnection("customer_account_state")
    .where({ customer_id: customerId })
    .first();

  if (!state || !state.email_verified_at) {
    return { linkedCount: 0, skippedUnverified: true };
  }

  const normalized = normalizeEmail(email);
  const guestOrders: Array<{ id: string }> = await pgConnection("order")
    .join("customer", "order.customer_id", "customer.id")
    .whereRaw('LOWER("order"."email") = ?', [normalized])
    .andWhere("customer.has_account", false)
    .whereNull("order.deleted_at")
    .select("order.id");

  if (!guestOrders || guestOrders.length === 0) {
    return { linkedCount: 0, skippedUnverified: false };
  }

  const orderIds = guestOrders.map((o) => o.id);
  await pgConnection("order").whereIn("id", orderIds).update({
    customer_id: customerId,
    updated_at: new Date(),
  });

  return { linkedCount: orderIds.length, skippedUnverified: false };
}
