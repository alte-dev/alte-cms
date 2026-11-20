import crypto from "node:crypto";
import { cookies } from "next/headers";

const CART_COOKIE_NAME = "cart_id";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const ORDER_CONFIRMATION_COOKIE_NAME = "_order_confirmation";
const ORDER_CONFIRMATION_MAX_AGE = 60 * 60; // 1 hour (3600s)
const ORDER_ID_REGEX = /^order_[A-Za-z0-9_-]{6,64}$/;

const CUSTOMER_SESSION_COOKIE_NAME = "alte_customer_session";
const CUSTOMER_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getOrderConfirmationSecret(): string | null {
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

/**
 * Signs an order ID with HMAC-SHA256 and an expiration timestamp.
 * Format: <orderId>.<expSec>.<macHex>
 */
export function signOrderConfirmationValue(
  orderId: string,
  secret: string,
  nowMs: number = Date.now(),
): string {
  if (!ORDER_ID_REGEX.test(orderId)) {
    throw new Error("Invalid orderId format for confirmation cookie.");
  }
  const expSec = Math.floor(nowMs / 1000) + ORDER_CONFIRMATION_MAX_AGE;
  const payload = `${orderId}.${expSec}`;
  const mac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

/**
 * Verifies a signed _order_confirmation cookie value using constant-time comparison.
 * Returns the clean orderId if valid and unexpired, otherwise undefined (fail-closed).
 */
export function verifyOrderConfirmationValue(
  rawValue: string | undefined,
  secret: string | null,
  nowMs: number = Date.now(),
): string | undefined {
  if (!rawValue || !secret) return undefined;
  const parts = rawValue.split(".");
  if (parts.length !== 3) return undefined;
  const [orderId, expStr, providedMac] = parts;
  if (!orderId || !ORDER_ID_REGEX.test(orderId)) return undefined;
  if (!expStr || !/^\d+$/.test(expStr)) return undefined;
  if (!providedMac || !/^[a-f0-9]{64}$/i.test(providedMac)) return undefined;

  const expSec = Number.parseInt(expStr, 10);
  if (!Number.isFinite(expSec) || expSec <= Math.floor(nowMs / 1000)) {
    return undefined;
  }

  const payload = `${orderId}.${expStr}`;
  const expectedMac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(providedMac.toLowerCase(), "utf8");
  const b = Buffer.from(expectedMac, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return undefined;
  }

  return orderId;
}

/**
 * Retrieves the current cart ID from the httpOnly session cookie.
 */
export async function getCartId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CART_COOKIE_NAME)?.value;
}

/**
 * Persists the cart ID into a secure, httpOnly, SameSite=Lax cookie.
 */
export async function setCartId(cartId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CART_COOKIE_NAME, cartId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: CART_COOKIE_MAX_AGE,
  });
}

/**
 * Removes the cart ID cookie.
 */
export async function deleteCartId(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CART_COOKIE_NAME);
}

/**
 * Retrieves and verifies the recent order ID from the HMAC-signed order confirmation cookie.
 */
export async function getOrderConfirmation(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ORDER_CONFIRMATION_COOKIE_NAME)?.value;
  return verifyOrderConfirmationValue(raw, getOrderConfirmationSecret());
}

/**
 * Sets a short-lived, HMAC-signed httpOnly cookie containing the completed order ID.
 */
export async function setOrderConfirmation(orderId: string): Promise<void> {
  const secret = getOrderConfirmationSecret();
  if (!secret) {
    throw new Error("INTERNAL_API_SECRET is required to sign order confirmation cookie.");
  }
  const signedValue = signOrderConfirmationValue(orderId, secret);
  const cookieStore = await cookies();
  cookieStore.set(ORDER_CONFIRMATION_COOKIE_NAME, signedValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ORDER_CONFIRMATION_MAX_AGE,
  });
}

/**
 * Removes the order confirmation cookie.
 */
export async function deleteOrderConfirmation(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ORDER_CONFIRMATION_COOKIE_NAME);
}

/**
 * Retrieves the customer session JWT from the httpOnly cookie.
 */
export async function getCustomerSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CUSTOMER_SESSION_COOKIE_NAME)?.value;
}

/**
 * Persists the customer session JWT into an httpOnly, SameSite=Lax, Secure (prod) cookie.
 */
export async function setCustomerSessionToken(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: CUSTOMER_SESSION_MAX_AGE,
  });
}

/**
 * Removes the customer session cookie.
 */
export async function deleteCustomerSessionToken(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_SESSION_COOKIE_NAME);
}
