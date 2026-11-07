import { listShippingOptionsForCartWorkflow } from "@medusajs/core-flows";
import { StepResponse } from "@medusajs/framework/workflows-sdk";

/**
 * Cart workflow hook to inject cart total/subtotal into shipping options evaluation context.
 * Enables conditional shipping options such as "Free Shipping over 1500 TL".
 */
listShippingOptionsForCartWorkflow.hooks.setShippingOptionsContext(async ({ cart }) => {
  const itemTotal = cart.item_total ?? cart.total ?? 0;
  const subtotal = cart.subtotal ?? 0;

  return new StepResponse({
    item_total: String(itemTotal),
    subtotal: String(subtotal),
  });
});
