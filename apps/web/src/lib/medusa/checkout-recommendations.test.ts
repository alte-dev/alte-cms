import { describe, expect, it, vi } from "vitest";
import {
  addRecommendedProductToCart,
  selectCheckoutRecommendations,
} from "./checkout-recommendations";
import { calculateCheckoutTotals } from "./checkout-pricing";
import type { StoreCart, StoreProduct, StoreShippingOption } from "./types";

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

describe("addRecommendedProductToCart & totals recalculation", () => {
  const shippingOption: StoreShippingOption = {
    id: "so_std",
    name: "Standart Kargo",
    price_type: "flat",
    amount: 50,
  };

  it("recalculates totals, tax, and shipping when a recommended product is added and returns error on second add when stock is 1", async () => {
    const upsellProduct = makeProduct("p_limited", "sinirli-urun", true);
    upsellProduct.variants![0].inventory_quantity = 1;

    const initialCart: StoreCart = {
      id: "cart_1",
      region_id: "reg_tr",
      currency_code: "try",
      total: 350,
      subtotal: 300,
      item_subtotal: 300,
      tax_total: 50,
      discount_total: 0,
      shipping_total: 50,
      items: [
        {
          id: "li_1",
          title: "Mevcut Ürün",
          product_id: "p_existing",
          variant_id: "var_existing",
          quantity: 1,
          unit_price: 300,
          subtotal: 250,
          tax_total: 50,
          total: 300,
        },
      ],
    };

    const updatedCart: StoreCart = {
      ...initialCart,
      subtotal: 550,
      item_subtotal: 550,
      tax_total: 91.67,
      total: 550,
      items: [
        ...initialCart.items,
        {
          id: "li_2",
          title: upsellProduct.title,
          product_id: upsellProduct.id,
          variant_id: upsellProduct.variants![0].id,
          quantity: 1,
          unit_price: 250,
          subtotal: 208.33,
          tax_total: 41.67,
          total: 250,
        },
      ],
    };

    const beforeTotals = calculateCheckoutTotals(initialCart, shippingOption, 100, "card");
    expect(beforeTotals.shippingCost).toBe(50);
    expect(beforeTotals.total).toBe(350);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, cart: updatedCart }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "Yetersiz stok: en fazla 1 adet eklenebilir." }),
      });

    // 1st click (+ Ekle): succeeds and totals recalculate (free shipping unlocked >= 500)
    const first = await addRecommendedProductToCart(upsellProduct, undefined, fetchMock as any);
    expect(first.ok).toBe(true);
    expect(first.error).toBeNull();
    expect(first.cart?.items).toHaveLength(2);

    const afterTotals = calculateCheckoutTotals(first.cart!, shippingOption, 100, "card");
    expect(afterTotals.itemTotal).toBe(550);
    expect(afterTotals.shippingCost).toBe(50);
    expect(afterTotals.taxTotal).toBe(91.67);
    expect(afterTotals.total).toBe(600);

    // 2nd click (+ Ekle) with stock 1 exhausted: must return error, not silently succeed
    const second = await addRecommendedProductToCart(upsellProduct, undefined, fetchMock as any);
    expect(second.ok).toBe(false);
    expect(second.cart).toBeNull();
    expect(second.error).toContain("Yetersiz stok");
  });

  it("refuses to call cart API silently when product is out of stock", async () => {
    const outOfStock = makeProduct("p_oos", "stok-yok", false);
    const fetchMock = vi.fn();
    const res = await addRecommendedProductToCart(outOfStock, undefined, fetchMock as any);
    expect(res.ok).toBe(false);
    expect(res.error).toContain("stokta yok");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
