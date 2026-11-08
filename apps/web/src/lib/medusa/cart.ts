import { medusaFetch } from "./client";
import { getCartId, setCartId } from "./cookies";
import { getDefaultRegion } from "./products";
import {
  StoreAddress,
  StoreCart,
  StoreCartResponse,
  StoreOrder,
  StoreOrderResponse,
  StoreShippingOption,
} from "./types";

const CART_FIELDS =
  "*items,*items.variant,*items.variant.product,*shipping_methods,*shipping_methods.shipping_option,*shipping_address,*billing_address,*promotions";

const ORDER_FIELDS = "*items,*items.variant,*shipping_address,*billing_address";

/**
 * Checks whether development dummy payment is allowed.
 * Fail-closed: Strictly forbidden in production; requires explicit ALLOW_DEV_PAYMENT=true in dev.
 */
export function isDevPaymentAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_PAYMENT === "true";
}

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
 * Updates cart general details (email, addresses, metadata).
 */
export async function updateCart(
  cartId: string,
  data: {
    email?: string;
    shipping_address?: Partial<StoreAddress>;
    billing_address?: Partial<StoreAddress>;
    metadata?: Record<string, unknown>;
    promo_codes?: string[];
  },
): Promise<StoreCart> {
  const res = await medusaFetch<StoreCartResponse>(`/store/carts/${cartId}?fields=${CART_FIELDS}`, {
    method: "POST",
    body: JSON.stringify(data),
    cache: "no-store",
  });
  return res.cart;
}

/**
 * Updates customer email and metadata on a cart.
 */
export async function updateCartCustomer(
  cartId: string,
  input: { email?: string; metadata?: Record<string, unknown> },
): Promise<StoreCart> {
  return updateCart(cartId, input);
}

/**
 * Sets shipping address on cart.
 */
export async function setCartShippingAddress(
  cartId: string,
  address: Partial<StoreAddress>,
): Promise<StoreCart> {
  return updateCart(cartId, { shipping_address: address });
}

/**
 * Sets billing address on cart.
 */
export async function setCartBillingAddress(
  cartId: string,
  address: Partial<StoreAddress>,
): Promise<StoreCart> {
  return updateCart(cartId, { billing_address: address });
}

/**
 * Selects/updates shipping option on the cart.
 */
export async function setCartShippingMethod(
  cartId: string,
  shippingOptionId: string,
): Promise<StoreCart> {
  const data = await medusaFetch<StoreCartResponse>(
    `/store/carts/${cartId}/shipping-methods?fields=${CART_FIELDS}`,
    {
      method: "POST",
      body: JSON.stringify({ option_id: shippingOptionId }),
      cache: "no-store",
    },
  );
  return data.cart;
}

/**
 * Applies a promotion code (coupon) to the cart.
 * Maps Medusa error to friendly Turkish validation message.
 */
export async function applyPromotionCode(cartId: string, code: string): Promise<StoreCart> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    throw new Error("Lütfen geçerli bir kupon kodu giriniz.");
  }

  try {
    const data = await medusaFetch<StoreCartResponse>(
      `/store/carts/${cartId}/promotions?fields=${CART_FIELDS}`,
      {
        method: "POST",
        body: JSON.stringify({ promo_codes: [cleanCode] }),
        cache: "no-store",
      },
    );
    return data.cart;
  } catch {
    throw new Error("Geçersiz veya süresi dolmuş kupon kodu.");
  }
}

/**
 * Removes an applied promotion code from the cart.
 */
export async function removePromotionCode(cartId: string, code: string): Promise<StoreCart> {
  const cleanCode = code.trim().toUpperCase();
  try {
    const data = await medusaFetch<StoreCartResponse>(
      `/store/carts/${cartId}/promotions?fields=${CART_FIELDS}`,
      {
        method: "DELETE",
        body: JSON.stringify({ promo_codes: [cleanCode] }),
        cache: "no-store",
      },
    );
    return data.cart;
  } catch {
    const refreshed = await getCart(cartId);
    if (!refreshed) {
      throw new Error("Kupon kaldırılamadı.");
    }
    return refreshed;
  }
}

export interface CompleteCartResult {
  success: boolean;
  order?: StoreOrder;
  error?: string;
}

export interface PaymentOptionsResult {
  paytr: {
    enabled: boolean;
    display_mode: "iframe" | "redirect";
  };
  cod: {
    enabled: boolean;
    fee: number;
    fee_label: string;
    max_order_amount: number | null;
  };
  dev: {
    enabled: boolean;
  };
}

/**
 * Retrieves public store payment configuration without exposing any secrets.
 */
export async function getPaymentOptions(): Promise<PaymentOptionsResult> {
  try {
    const data = await medusaFetch<PaymentOptionsResult>("/store/payment-options", {
      cache: "no-store",
    });
    return data;
  } catch {
    return {
      paytr: { enabled: false, display_mode: "iframe" },
      cod: {
        enabled: true,
        fee: 10000,
        fee_label: "Kapıda Ödeme Hizmet Bedeli",
        max_order_amount: null,
      },
      dev: { enabled: isDevPaymentAllowed() },
    };
  }
}

/**
 * Retrieves or initializes payment collection for a cart.
 */
export async function getOrCreatePaymentCollection(cartId: string): Promise<string> {
  const collectionData = await medusaFetch<{ payment_collection: { id: string } }>(
    "/store/payment-collections",
    {
      method: "POST",
      body: JSON.stringify({ cart_id: cartId }),
      cache: "no-store",
    },
  );

  const paymentCollectionId = collectionData?.payment_collection?.id;
  if (!paymentCollectionId) {
    throw new Error("Ödeme oturumu başlatılamadı.");
  }
  return paymentCollectionId;
}

/**
 * Creates or refreshes a payment session for given provider on a cart.
 */
export async function createPaymentSession(
  cartId: string,
  providerId: "pp_paytr_paytr" | "pp_cod_cod" | "pp_system_default",
) {
  const collectionId = await getOrCreatePaymentCollection(cartId);
  const res = await medusaFetch<{
    payment_collection: {
      id: string;
      payment_sessions: Array<{
        id: string;
        provider_id: string;
        data?: Record<string, any>;
      }>;
    };
  }>(`/store/payment-collections/${collectionId}/payment-sessions`, {
    method: "POST",
    body: JSON.stringify({
      provider_id: providerId,
      data: { cart_id: cartId },
    }),
    cache: "no-store",
  });

  const session = res?.payment_collection?.payment_sessions?.find(
    (s) => s.provider_id === providerId,
  );
  return { collectionId, session };
}

/**
 * Initiates PayTR payment session and returns token and iframe/redirect url.
 */
export async function initiatePaytrPayment(cartId: string) {
  const { session } = await createPaymentSession(cartId, "pp_paytr_paytr");
  if (!session || !session.data) {
    throw new Error("PayTR ödeme oturumu başlatılamadı.");
  }

  const token = session.data.token as string | undefined;
  const iframe_url = session.data.iframe_url as string | undefined;
  const display_mode = (session.data.display_mode as "iframe" | "redirect") || "iframe";

  if (!token) {
    const errorReason =
      (session.data.error as string) ||
      "PayTR token alınamadı. Lütfen ödeme ayarlarını ve internet bağlantınızı kontrol ediniz.";
    throw new Error(errorReason);
  }

  return {
    token,
    iframeUrl: iframe_url || `https://www.paytr.com/odeme/guvenli/${token}`,
    displayMode: display_mode,
  };
}

/**
 * Completes a cart to create an order.
 * Strictly checks environment when using dev dummy provider.
 */
export async function completeCart(
  cartId: string,
  providerId: "pp_paytr_paytr" | "pp_cod_cod" | "pp_system_default" = "pp_system_default",
): Promise<CompleteCartResult> {
  if (providerId === "pp_system_default" && !isDevPaymentAllowed()) {
    return {
      success: false,
      error: "Geliştirici sahte ödeme yöntemi üretim ortamında kullanılamaz.",
    };
  }

  try {
    // 1. Initialize payment session with selected provider
    await createPaymentSession(cartId, providerId);

    // 2. Complete cart
    const completeRes = await medusaFetch<{
      type: "order" | "cart";
      order?: StoreOrder;
      cart?: StoreCart;
      error?: { message: string; name: string; type: string };
    }>(`/store/carts/${cartId}/complete`, {
      method: "POST",
      cache: "no-store",
    });

    if (completeRes.type === "order" && completeRes.order) {
      return {
        success: true,
        order: completeRes.order,
      };
    }

    if (completeRes.error) {
      return {
        success: false,
        error: completeRes.error.message || "Sipariş tamamlanırken bir hata oluştu.",
      };
    }

    return {
      success: false,
      error: "Sipariş tamamlanamadı.",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Sipariş tamamlanamadı.",
    };
  }
}

/**
 * Retrieves an order by its UUID.
 */
export async function getOrder(orderId: string): Promise<StoreOrder | null> {
  if (!orderId) return null;
  try {
    const data = await medusaFetch<StoreOrderResponse>(
      `/store/orders/${orderId}?fields=${ORDER_FIELDS}`,
      { cache: "no-store" },
    );
    return data.order || null;
  } catch {
    return null;
  }
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
  options: Array<{ id: string; name: string }>;
  shipping_options?: Array<{ id: string; name: string }>;
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
    return {
      threshold: data.threshold,
      options: data.options || data.shipping_options || [],
      shipping_options: data.options || data.shipping_options || [],
    };
  } catch {
    return {
      threshold: null,
      options: [],
      shipping_options: [],
    };
  }
}
