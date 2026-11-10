import type { StoreCart, StoreShippingOption } from "./types";

/**
 * Determines the best default shipping option for a customer checkout.
 *
 * Rules:
 * 1. If cart already has a shipping method assigned and it exists in available options, keep it.
 * 2. If an "Ücretsiz Kargo" (free home delivery) option is available (amount === 0, name matches free/ücretsiz),
 *    prioritize it as default so customers are never inadvertently charged for shipping when eligible!
 * 3. Otherwise, pick standard shipping (if available) or the first available option.
 */
export function getDefaultShippingOptionId(
  options: StoreShippingOption[],
  existingMethodOptionId?: string | null,
): string {
  if (!options || options.length === 0) return "";

  if (existingMethodOptionId && options.some((o) => o.id === existingMethodOptionId)) {
    return existingMethodOptionId;
  }

  // Find explicit free shipping option (home delivery, amount === 0)
  const freeOption = options.find((o) => {
    const isZero = o.amount === 0;
    const nameLower = (o.name || "").toLowerCase();
    const isFreeByName = nameLower.includes("ücretsiz") || nameLower.includes("free");
    const isPickup = nameLower.includes("mağaza") || nameLower.includes("pickup");
    return isZero && (isFreeByName || !isPickup);
  });

  if (freeOption) {
    return freeOption.id;
  }

  // Next preference: Standard shipping over pickup
  const standardOption = options.find((o) => {
    const nameLower = (o.name || "").toLowerCase();
    return nameLower.includes("standart") || nameLower.includes("standard");
  });

  if (standardOption) {
    return standardOption.id;
  }

  return options[0]?.id || "";
}

/**
 * Sorts shipping options so that "Ücretsiz Kargo" appears at the top,
 * followed by standard home delivery, followed by store pickup.
 */
export function sortShippingOptions(options: StoreShippingOption[]): StoreShippingOption[] {
  if (!options || options.length <= 1) return options;

  return [...options].sort((a, b) => {
    const aName = (a.name || "").toLowerCase();
    const bName = (b.name || "").toLowerCase();

    const aIsFree = a.amount === 0 && (aName.includes("ücretsiz") || aName.includes("free"));
    const bIsFree = b.amount === 0 && (bName.includes("ücretsiz") || bName.includes("free"));
    if (aIsFree && !bIsFree) return -1;
    if (!aIsFree && bIsFree) return 1;

    const aIsPickup = aName.includes("mağaza") || aName.includes("pickup");
    const bIsPickup = bName.includes("mağaza") || bName.includes("pickup");
    if (!aIsPickup && bIsPickup) return -1;
    if (aIsPickup && !bIsPickup) return 1;

    return 0;
  });
}

export interface CheckoutTotals {
  itemTotal: number;
  subtotalNet: number;
  taxTotal: number;
  discountTotal: number;
  shippingCost: number;
  configuredCodFee: number;
  codFee: number;
  total: number;
}

/**
 * Calculates accurate cart / checkout totals complying with Turkish tax-inclusive pricing.
 */
export function calculateCheckoutTotals(
  cart: StoreCart,
  selectedOption?: StoreShippingOption | null,
  codFeeInput: number = 0,
  paymentMethod: string = "card",
): CheckoutTotals {
  // 1. itemTotal: KDV Dahil ürün toplamı
  const calculatedItemsTotal = (cart.items || []).reduce(
    (sum, item) => sum + (item.unit_price || 0) * item.quantity,
    0,
  );
  const itemTotal =
    calculatedItemsTotal > 0 ? calculatedItemsTotal : (cart.item_total ?? cart.total ?? 0);

  // 2. subtotalNet: KDV Hariç ürün toplamı (Medusa subtotal / item_subtotal is already tax-exclusive)
  const taxTotal = cart.tax_total ?? 0;
  const subtotalNet = cart.item_subtotal ?? cart.subtotal ?? Math.max(0, itemTotal - taxTotal);

  // 3. discountTotal
  const discountTotal = cart.discount_total ?? 0;

  // 4. shippingCost
  const shippingCost = selectedOption?.amount ?? cart.shipping_total ?? 0;

  // 5. codFee: configured fee for display vs. applied fee based on selected payment method
  const rawCod = codFeeInput > 500 ? codFeeInput / 100 : codFeeInput;
  const configuredCodFee = Math.max(0, rawCod);
  const codFee = paymentMethod === "cod" ? configuredCodFee : 0;

  // 6. Grand total (KDV dahil ödenecek tutar)
  const total = Math.max(0, itemTotal - discountTotal + shippingCost + codFee);

  return {
    itemTotal,
    subtotalNet,
    taxTotal,
    discountTotal,
    shippingCost,
    configuredCodFee,
    codFee,
    total,
  };
}
