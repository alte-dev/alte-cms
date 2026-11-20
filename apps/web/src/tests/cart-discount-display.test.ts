import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveCartLinePricing, calculateCartTotalSavings } from "../lib/medusa/cart-pricing";
import { CheckoutOrderSummaryItem } from "../components/checkout-order-summary-item";
import type { StoreCartLineItem } from "../lib/medusa/types";

function makeLineItem(overrides: Partial<StoreCartLineItem> = {}): StoreCartLineItem {
  return {
    id: "item_1",
    title: "Waffle Dokulu Banyo Havlusu Seti",
    product_title: "Waffle Dokulu Banyo Havlusu Seti",
    variant_title: "Taş",
    quantity: 2,
    unit_price: 632,
    compare_at_unit_price: 790,
    subtotal: 1053.33,
    tax_total: 210.67,
    total: 1264,
    discount_total: 0,
    ...overrides,
  };
}

describe("Cart & Checkout Discount Pricing Display", () => {
  describe("resolveCartLinePricing", () => {
    it("computes original price, discounted price, savings and percentage for sale price-list items", () => {
      const pricing = resolveCartLinePricing(makeLineItem());
      expect(pricing.isDiscounted).toBe(true);
      expect(pricing.originalUnitPrice).toBe(790);
      expect(pricing.currentUnitPrice).toBe(632);
      expect(pricing.originalLineTotal).toBe(1580);
      expect(pricing.currentLineTotal).toBe(1264);
      expect(pricing.discountPercent).toBe(20);
      expect(pricing.lineSavings).toBe(316);
    });

    it("computes discount from line-level coupon adjustments when compare_at_unit_price is absent", () => {
      const pricing = resolveCartLinePricing(
        makeLineItem({
          unit_price: 1450,
          compare_at_unit_price: null,
          quantity: 2,
          total: 2726,
          discount_total: 174,
        }),
      );
      expect(pricing.isDiscounted).toBe(true);
      expect(pricing.originalUnitPrice).toBe(1450);
      expect(pricing.currentUnitPrice).toBe(1363);
      expect(pricing.originalLineTotal).toBe(2900);
      expect(pricing.currentLineTotal).toBe(2726);
      expect(pricing.discountPercent).toBe(6);
      expect(pricing.lineSavings).toBe(174);
    });

    it("combines sale price-list markdown and line-level coupon discount accurately", () => {
      const pricing = resolveCartLinePricing(
        makeLineItem({
          compare_at_unit_price: 790,
          unit_price: 632,
          quantity: 2,
          discount_total: 126.4,
          total: 1137.6,
        }),
      );
      expect(pricing.isDiscounted).toBe(true);
      expect(pricing.originalLineTotal).toBe(1580);
      expect(pricing.currentLineTotal).toBeCloseTo(1137.6, 2);
      expect(pricing.discountPercent).toBe(28);
      expect(pricing.lineSavings).toBeCloseTo(442.4, 2);
    });

    it("returns isDiscounted=false for regular non-discounted items", () => {
      const pricing = resolveCartLinePricing(
        makeLineItem({
          unit_price: 500,
          compare_at_unit_price: null,
          quantity: 1,
          total: 500,
          discount_total: 0,
        }),
      );
      expect(pricing.isDiscounted).toBe(false);
      expect(pricing.discountPercent).toBe(0);
      expect(pricing.lineSavings).toBe(0);
      expect(pricing.originalLineTotal).toBe(500);
      expect(pricing.currentLineTotal).toBe(500);
    });

    it("never marks COD service fee items as discounted", () => {
      const pricing = resolveCartLinePricing(
        makeLineItem({
          unit_price: 100,
          compare_at_unit_price: 150,
          quantity: 1,
          metadata: { is_cod_fee: true },
        }),
      );
      expect(pricing.isDiscounted).toBe(false);
      expect(pricing.lineSavings).toBe(0);
    });
  });

  describe("calculateCartTotalSavings", () => {
    it("sums compare-at price-list savings and cart coupon discount without double counting", () => {
      const items = [
        makeLineItem({ compare_at_unit_price: 790, unit_price: 632, quantity: 2 }), // 316 TL
        makeLineItem({
          id: "item_2",
          compare_at_unit_price: null,
          unit_price: 500,
          quantity: 1,
        }), // 0 TL
      ];
      expect(calculateCartTotalSavings(items, 0)).toBe(316);
      expect(calculateCartTotalSavings(items, 100)).toBe(416);
    });
  });

  describe("CheckoutOrderSummaryItem", () => {
    it("renders discount percentage badge, strikethrough original total, and discounted total", () => {
      const html = renderToStaticMarkup(
        React.createElement(CheckoutOrderSummaryItem, { item: makeLineItem() }),
      );
      expect(html).toContain("-%20");
      expect(html).toContain("line-through");
      expect(html).toContain("1.580,00");
      expect(html).toContain("1.264,00");
    });

    it("renders single price without strikethrough for non-discounted items", () => {
      const html = renderToStaticMarkup(
        React.createElement(CheckoutOrderSummaryItem, {
          item: makeLineItem({
            unit_price: 500,
            compare_at_unit_price: null,
            quantity: 1,
            total: 500,
          }),
        }),
      );
      expect(html).not.toContain("line-through");
      expect(html).not.toContain("-%");
      expect(html).toContain("500,00");
    });
  });
});
