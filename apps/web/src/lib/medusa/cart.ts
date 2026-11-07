import { medusaFetch } from "./client";
import { getCartId, setCartId } from "./cookies";
import { getDefaultRegion } from "./products";
import { StoreCart, StoreCartResponse, StoreShippingOption } from "./types";

const CART_FIELDS =
  "*items,*items.variant,*items.variant.product,*shipping_methods,*shipping_methods.shipping_option";

/**
 * Retrieves a cart by ID from Medusa Store API.
 */
export async function getCart(cartId: string): Promise<StoreCart | null> {
  if (!cartId) return null;

  try {
    const data = await medusaFetch<StoreCartResponse>(
      `/store/carts/${cartId}?fields=${CART_FIELDS}`,
      { cache: "no-store" },
    );
    return data.cart || null;
  } catch {
    return null;
  }
}

/**
 * Creates a new cart in Medusa assigned to Türkiye region.
 */
export async function createCart(regionId?: string): Promise<StoreCart> {
  let targetRegionId = regionId;
  if (!targetRegionId) {
    const region = await getDefaultRegion();
    targetRegionId = region?.id;
  }

  const data = await medusaFetch<StoreCartResponse>(`/store/carts?fields=${CART_FIELDS}`, {
    method: "POST",
    body: JSON.stringify({
      ...(targetRegionId ? { region_id: targetRegionId } : {}),
    }),
    cache: "no-store",
  });

  return data.cart;
}

/**
 * Retrieves the current cart from session cookie or creates a new one.
 */
export async function getOrCreateCart(): Promise<StoreCart> {
  const existingCartId = await getCartId();

  if (existingCartId) {
    const existingCart = await getCart(existingCartId);
    if (existingCart && !existingCart.completed_at) {
      return existingCart;
    }
  }

  const newCart = await createCart();
  await setCartId(newCart.id);
  return newCart;
}

/**
 * Adds an item (variant + quantity) to the cart.
 * If insufficient inventory, Medusa throws 400 with 'insufficient_inventory'.
 */
export async function addItemToCart(
  cartId: string,
  variantId: string,
  quantity: number = 1,
): Promise<StoreCart> {
  const data = await medusaFetch<StoreCartResponse>(
    `/store/carts/${cartId}/line-items?fields=${CART_FIELDS}`,
    {
      method: "POST",
      body: JSON.stringify({
        variant_id: variantId,
        quantity,
      }),
      cache: "no-store",
    },
  );

  return data.cart;
}

/**
 * Updates quantity of an existing line item in the cart.
 */
export async function updateCartItem(
  cartId: string,
  lineItemId: string,
  quantity: number,
): Promise<StoreCart> {
  if (quantity <= 0) {
    return removeCartItem(cartId, lineItemId);
  }

  const data = await medusaFetch<StoreCartResponse>(
    `/store/carts/${cartId}/line-items/${lineItemId}?fields=${CART_FIELDS}`,
    {
      method: "POST",
      body: JSON.stringify({ quantity }),
      cache: "no-store",
    },
  );

  return data.cart;
}

/**
 * Deletes a line item from the cart.
 */
export async function removeCartItem(cartId: string, lineItemId: string): Promise<StoreCart> {
  await medusaFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    method: "DELETE",
    cache: "no-store",
  });

  const refreshedCart = await getCart(cartId);
  if (!refreshedCart) {
    throw new Error("Sepet güncellenemedi.");
  }
  return refreshedCart;
}

/**
 * Fetches available shipping options for a cart.
 */
export async function getCartShippingOptions(cartId: string): Promise<StoreShippingOption[]> {
  try {
    const data = await medusaFetch<{ shipping_options: StoreShippingOption[] }>(
      `/store/shipping-options?cart_id=${cartId}&fields=*rules`,
      { cache: "no-store" },
    );
    return data.shipping_options || [];
  } catch {
    return [];
  }
}

export interface ShippingRulesResult {
  threshold: number | null;
  shipping_options: StoreShippingOption[];
}

/**
 * Dynamically fetches shipping rules (including free shipping threshold) from Medusa.
 * Threshold is NOT hardcoded; if not found or cannot be read, returns threshold: null.
 */
export async function getShippingRules(): Promise<ShippingRulesResult> {
  try {
    const data = await medusaFetch<ShippingRulesResult>("/store/shipping-rules", {
      next: { revalidate: 60 },
    });
    return data;
  } catch {
    return {
      threshold: null,
      shipping_options: [],
    };
  }
}
