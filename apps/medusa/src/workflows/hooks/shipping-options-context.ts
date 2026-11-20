import {
  listShippingOptionsForCartWorkflow,
  listShippingOptionsForCartWithPricingWorkflow,
} from "@medusajs/core-flows";
import { StepResponse } from "@medusajs/framework/workflows-sdk";

interface CartItemLike {
  total?: number | null;
  unit_price?: number | null;
  quantity?: number | null;
  metadata?: Record<string, unknown> | null;
  variant?: { sku?: string | null } | null;
}

interface CartContextLike {
  item_total?: number | null;
  total?: number | null;
  subtotal?: number | null;
  items?: CartItemLike[] | null;
}

function isCodFeeLineItem(item: CartItemLike): boolean {
  return Boolean(item.metadata?.is_cod_fee) || item.variant?.sku === "SERVICE-COD-FEE";
}

/**
 * Computes shipping-option evaluation context from cart totals, excluding COD service fee items
 * so free-shipping thresholds apply strictly to product value.
 */
export function buildShippingOptionsContext(cart: CartContextLike): Record<string, string> {
  const rawItemTotal = Number(cart.item_total ?? cart.total ?? 0);
  let codFeeTotal = 0;

  if (Array.isArray(cart.items)) {
    for (const item of cart.items) {
      if (!isCodFeeLineItem(item)) continue;
      const lineAmount =
        typeof item.total === "number" && Number.isFinite(item.total)
          ? item.total
          : Number(item.unit_price ?? 0) * Math.max(1, Number(item.quantity ?? 1));
      if (Number.isFinite(lineAmount) && lineAmount > 0) {
        codFeeTotal += lineAmount;
      }
    }
  }

  const effectiveItemTotal = Math.max(0, rawItemTotal - codFeeTotal);
  const subtotal = Number(cart.subtotal ?? 0);

  return {
    item_total: String(effectiveItemTotal),
    subtotal: String(subtotal),
  };
}

/**
 * Cart workflow hooks to inject cart total/subtotal into shipping options evaluation context.
 * Registered on BOTH listShippingOptionsForCartWorkflow (used by GET /store/shipping-options)
 * and listShippingOptionsForCartWithPricingWorkflow (used by POST /store/carts/:id/shipping-methods)
 * so conditional shipping options such as "Ücretsiz Kargo >= 1500 TL" evaluate consistently.
 */
listShippingOptionsForCartWorkflow.hooks.setShippingOptionsContext(async ({ cart }) => {
  return new StepResponse(buildShippingOptionsContext(cart as CartContextLike));
});

listShippingOptionsForCartWithPricingWorkflow.hooks.setShippingOptionsContext(async ({ cart }) => {
  return new StepResponse(buildShippingOptionsContext(cart as CartContextLike));
});
