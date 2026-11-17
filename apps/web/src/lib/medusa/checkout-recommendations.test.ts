import { describe, expect, it } from "vitest";
import { selectCheckoutRecommendations } from "./checkout-recommendations";
import type { StoreProduct } from "./types";

function makeProduct(id: string, handle: string, inStock = true): StoreProduct {
  return {
    id,
    title: `Product ${handle}`,
    handle,
    status: "published",
    created_at: "2026-01-01T00:00:00Z",
    variants: [
      {
        id: `var_${id}`,
        title: "Default",
        sku: `SKU-${id}`,
        manage_inventory: true,
        inventory_quantity: inStock ? 5 : 0,
        allow_backorder: false,
        calculated_price: {
          calculated_amount: 250,
          original_amount: 250,
          currency_code: "try",
        },
      },
    ],
  };
}

describe("selectCheckoutRecommendations", () => {
  const products = [
    makeProduct("p1", "sal-1", true),
    makeProduct("p2", "sal-2", true),
    makeProduct("p3", "sal-3", false),
    makeProduct("p4", "sal-4", true),
    makeProduct("p5", "sal-5", true),
  ];

  it("excludes items already in cart and out-of-stock products in bestsellers mode", () => {
    const res = selectCheckoutRecommendations({
      products,
      cartProductIds: new Set(["p1"]),
      source: "bestsellers",
      limit: 3,
    });
    expect(res.map((p) => p.id)).toEqual(["p2", "p4", "p5"]);
  });

  it("respects manual handle order and ignores missing/cart/out-of-stock handles", () => {
    const res = selectCheckoutRecommendations({
      products,
      cartProductIds: new Set(["p2"]),
      source: "manual",
      manualHandles: "sal-5, sal-3, sal-1, unknown-handle",
      limit: 3,
    });
    expect(res.map((p) => p.id)).toEqual(["p5", "p1"]);
  });

  it("clamps limit between 1 and 4", () => {
    const res = selectCheckoutRecommendations({
      products,
      cartProductIds: new Set(),
      source: "bestsellers",
      limit: 10,
    });
    expect(res).toHaveLength(4);
  });
});
