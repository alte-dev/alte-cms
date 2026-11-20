import type { StoreCartLineItem } from "./types";

export interface CartLinePricing {
  isDiscounted: boolean;
  originalUnitPrice: number;
  currentUnitPrice: number;
  originalLineTotal: number;
  currentLineTotal: number;
  lineSavings: number;
  discountPercent: number;
}

function isCodFeeItem(item: StoreCartLineItem): boolean {
  return Boolean(item.metadata?.is_cod_fee) || item.variant?.sku === "SERVICE-COD-FEE";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Computes display pricing for a cart line item, combining Medusa's sale price-list
 * compare_at_unit_price and any line-level promotion discount_total.
 */
export function resolveCartLinePricing(item: StoreCartLineItem): CartLinePricing {
  const quantity = Math.max(1, item.quantity || 1);
  const unitPrice = Number.isFinite(item.unit_price) ? item.unit_price : 0;
  const baseLineTotal =
    (unitPrice > 0 ? unitPrice * quantity : 0) || item.total || item.subtotal || 0;

  if (isCodFeeItem(item)) {
    return {
      isDiscounted: false,
      originalUnitPrice: unitPrice,
      currentUnitPrice: unitPrice,
      originalLineTotal: roundMoney(baseLineTotal),
      currentLineTotal: roundMoney(baseLineTotal),
      lineSavings: 0,
      discountPercent: 0,
    };
  }

  const compareAt =
    typeof item.compare_at_unit_price === "number" &&
    Number.isFinite(item.compare_at_unit_price) &&
    item.compare_at_unit_price > unitPrice
      ? item.compare_at_unit_price
      : null;

  const lineCouponDiscount =
    typeof item.discount_total === "number" &&
    Number.isFinite(item.discount_total) &&
    item.discount_total > 0
      ? item.discount_total
      : 0;

  const originalUnitPrice = compareAt ?? unitPrice;
  const originalLineTotal = roundMoney(compareAt !== null ? compareAt * quantity : baseLineTotal);

  const currentLineTotal = roundMoney(
    lineCouponDiscount > 0 ? Math.max(0, baseLineTotal - lineCouponDiscount) : baseLineTotal,
  );
  const currentUnitPrice = roundMoney(currentLineTotal / quantity);

  const lineSavings = roundMoney(Math.max(0, originalLineTotal - currentLineTotal));
  const isDiscounted = lineSavings > 0.009 && originalLineTotal > 0;
  const discountPercent = isDiscounted
    ? Math.max(1, Math.round((lineSavings / originalLineTotal) * 100))
    : 0;

  return {
    isDiscounted,
    originalUnitPrice: roundMoney(originalUnitPrice),
    currentUnitPrice,
    originalLineTotal,
    currentLineTotal,
    lineSavings,
    discountPercent,
  };
}

/**
 * Calculates total cart savings by combining compare-at (sale price list) savings across
 * product items with cart-level promotion/coupon discount_total (without double counting).
 */
export function calculateCartTotalSavings(
  items: StoreCartLineItem[],
  cartDiscountTotal: number = 0,
): number {
  let compareAtSavings = 0;
  for (const item of items) {
    if (isCodFeeItem(item)) continue;
    const quantity = Math.max(1, item.quantity || 1);
    const unitPrice = Number.isFinite(item.unit_price) ? item.unit_price : 0;
    const compareAt =
      typeof item.compare_at_unit_price === "number" &&
      Number.isFinite(item.compare_at_unit_price) &&
      item.compare_at_unit_price > unitPrice
        ? item.compare_at_unit_price
        : null;
    if (compareAt !== null) {
      compareAtSavings += (compareAt - unitPrice) * quantity;
    }
  }

  const couponSavings =
    typeof cartDiscountTotal === "number" &&
    Number.isFinite(cartDiscountTotal) &&
    cartDiscountTotal > 0
      ? cartDiscountTotal
      : 0;

  return roundMoney(compareAtSavings + couponSavings);
}
