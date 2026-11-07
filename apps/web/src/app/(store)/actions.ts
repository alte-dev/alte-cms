"use server";

import { revalidatePath } from "next/cache";
import {
  addItemToCart,
  getOrCreateCart,
  removeCartItem,
  updateCartItem,
} from "../../lib/medusa/cart";
import { mapMedusaError } from "../../lib/medusa/format";
import { AddToCartSchema, UpdateCartItemSchema } from "../../lib/medusa/validation";

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server Action: Add a product variant to the current cart.
 */
export async function addToCartAction(input: {
  variantId: string;
  quantity?: number;
}): Promise<ActionResult> {
  const parsed = AddToCartSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Geçersiz ürün bilgisi.",
    };
  }

  try {
    const cart = await getOrCreateCart();
    const updatedCart = await addItemToCart(cart.id, parsed.data.variantId, parsed.data.quantity);

    revalidatePath("/sepet");
    revalidatePath("/(store)", "layout");

    return {
      success: true,
      data: updatedCart,
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapMedusaError(err),
    };
  }
}

/**
 * Server Action: Update item quantity in the cart.
 */
export async function updateCartItemAction(input: {
  lineItemId: string;
  quantity: number;
}): Promise<ActionResult> {
  const parsed = UpdateCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Geçersiz adet.",
    };
  }

  try {
    const cart = await getOrCreateCart();
    const updatedCart = await updateCartItem(cart.id, parsed.data.lineItemId, parsed.data.quantity);

    revalidatePath("/sepet");
    revalidatePath("/(store)", "layout");

    return {
      success: true,
      data: updatedCart,
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapMedusaError(err),
    };
  }
}

/**
 * Server Action: Remove item from cart.
 */
export async function removeCartItemAction(lineItemId: string): Promise<ActionResult> {
  if (!lineItemId) {
    return { success: false, error: "Kalem ID eksik." };
  }

  try {
    const cart = await getOrCreateCart();
    const updatedCart = await removeCartItem(cart.id, lineItemId);

    revalidatePath("/sepet");
    revalidatePath("/(store)", "layout");

    return {
      success: true,
      data: updatedCart,
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapMedusaError(err),
    };
  }
}
