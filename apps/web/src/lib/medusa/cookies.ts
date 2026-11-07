import { cookies } from "next/headers";

const CART_COOKIE_NAME = "cart_id";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const ORDER_CONFIRMATION_COOKIE_NAME = "_order_confirmation";
const ORDER_CONFIRMATION_MAX_AGE = 60 * 60; // 1 hour (3600s)

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
 * Retrieves the recent order ID from the short-lived order confirmation cookie.
 */
export async function getOrderConfirmation(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ORDER_CONFIRMATION_COOKIE_NAME)?.value;
}

/**
 * Sets a short-lived httpOnly cookie containing the completed order ID.
 */
export async function setOrderConfirmation(orderId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ORDER_CONFIRMATION_COOKIE_NAME, orderId, {
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
