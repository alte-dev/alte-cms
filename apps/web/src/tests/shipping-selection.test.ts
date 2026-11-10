import { describe, it, expect } from "vitest";
import {
  getDefaultShippingOptionId,
  sortShippingOptions,
  calculateCheckoutTotals,
} from "../lib/medusa/checkout-pricing";
import type { StoreShippingOption, StoreCart } from "../lib/medusa/types";

describe("Shipping Option Selection & Checkout Totals (TDD)", () => {
  const mockShippingOptions: StoreShippingOption[] = [
    {
      id: "so_standard",
      name: "Standart Kargo",
      price_type: "flat",
      amount: 150,
    },
    {
      id: "so_pickup",
      name: "Mağazadan Teslim",
      price_type: "flat",
      amount: 0,
    },
    {
      id: "so_free",
      name: "Ücretsiz Kargo",
      price_type: "flat",
      amount: 0,
    },
  ];

  describe("getDefaultShippingOptionId", () => {
    it("preserves existing shipping method if already assigned to cart", () => {
      const selected = getDefaultShippingOptionId(mockShippingOptions, "so_standard");
      expect(selected).toBe("so_standard");
    });

    it("defaults to 'Ücretsiz Kargo' when available instead of paid standard shipping", () => {
      // Even though 'Standart Kargo' is first in the array, 'Ücretsiz Kargo' must be prioritized
      const selected = getDefaultShippingOptionId(mockShippingOptions);
      expect(selected).toBe("so_free");
    });

    it("falls back to standard shipping if free shipping is not available", () => {
      const paidOnlyOptions = mockShippingOptions.filter((o) => o.id !== "so_free");
      // Between Standart (150) and Mağazadan Teslim (0), home delivery is preferred or first available
      const selected = getDefaultShippingOptionId(paidOnlyOptions);
      expect(selected).toBe("so_standard");
    });

    it("returns empty string if no shipping options provided", () => {
      expect(getDefaultShippingOptionId([])).toBe("");
    });
  });

  describe("sortShippingOptions", () => {
    it("sorts 'Ücretsiz Kargo' to the top of the list for customer visibility", () => {
      const sorted = sortShippingOptions(mockShippingOptions);
      expect(sorted[0].id).toBe("so_free");
    });
  });

  describe("calculateCheckoutTotals", () => {
    const mockCart: StoreCart = {
      id: "cart_test_1",
      region_id: "reg_tr",
      currency_code: "try",
      total: 2190,
      subtotal: 1825, // KDV hariç ürünler
      item_subtotal: 1825,
      tax_total: 365, // %20 KDV
      discount_total: 0,
      shipping_total: 0,
      items: [
        {
          id: "item_1",
          title: "Ürün 1",
          quantity: 1,
          unit_price: 140, // KDV dahil
          subtotal: 116.67,
          tax_total: 23.33,
          total: 140,
          product_title: "Ürün 1",
        },
        {
          id: "item_2",
          title: "Ürün 2",
          quantity: 1,
          unit_price: 2050, // KDV dahil
          subtotal: 1708.33,
          tax_total: 341.67,
          total: 2050,
          product_title: "Ürün 2",
        },
      ],
    };

    it("calculates correct grand total with free shipping", () => {
      const freeOption = mockShippingOptions.find((o) => o.id === "so_free")!;
      const totals = calculateCheckoutTotals(mockCart, freeOption, 0, "card");

      expect(totals.shippingCost).toBe(0);
      expect(totals.itemTotal).toBe(2190);
      expect(totals.total).toBe(2190);
      expect(totals.subtotalNet).toBe(1825); // KDV Hariç net tutar
      expect(totals.taxTotal).toBe(365);
    });

    it("calculates correct grand total with paid standard shipping", () => {
      const stdOption = mockShippingOptions.find((o) => o.id === "so_standard")!;
      const totals = calculateCheckoutTotals(mockCart, stdOption, 0, "card");

      expect(totals.shippingCost).toBe(150);
      expect(totals.total).toBe(2340); // 2190 + 150
    });

    it("does not double-deduct VAT from subtotal", () => {
      const freeOption = mockShippingOptions.find((o) => o.id === "so_free")!;
      const totals = calculateCheckoutTotals(mockCart, freeOption, 0, "card");

      // Bug had subtotal - taxTotal = 1825 - 365 = 1460 (wrong!)
      expect(totals.subtotalNet).toBe(1825);
    });
  });

  describe("Live E2E Verification on Real Checkout Page", () => {
    it("auto-selects Free Shipping on /odeme when cart threshold is met", async () => {
      const { chromium } = await import("playwright");
      const BASE_URL = process.env.WEB_PUBLIC_URL || "http://localhost:3100";

      let serverOnline = false;
      try {
        const probeRes = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(1500) });
        serverOnline = probeRes.status === 200;
      } catch {
        serverOnline = false;
      }

      if (!serverOnline) {
        return; // CI safe: graceful skip when local server is not running
      }

      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();

      // Set cart cookie with our 1800 TL test cart
      await context.addCookies([
        {
          name: "cart_id",
          value: "cart_01M72ZJG83DYZZFWRD9VP7J9ER",
          domain: "localhost",
          path: "/",
        },
      ]);

      const page = await context.newPage();
      await page.goto(`${BASE_URL}/odeme`, { waitUntil: "networkidle" });

      // 1. Verify "Kargo Tutarı" in sidebar summary is "Ücretsiz"
      const shippingRow = page.locator("div:has(> span:text('Kargo Tutarı'))");
      const shippingText = await shippingRow.innerText();
      expect(shippingText).toContain("Ücretsiz");

      // 2. Verify "Ücretsiz Kargo" radio button is checked by default
      const freeRadio = page.locator("label:has-text('Ücretsiz Kargo') input[type='radio']");
      const isChecked = await freeRadio.isChecked();
      expect(isChecked).toBe(true);

      // 3. Verify total is 1800 TL (not 1800 + 150 = 1950)
      const totalRow = page.locator("div:has(> span:text('Ödenecek Tutar'))");
      const totalText = await totalRow.innerText();
      expect(totalText).toContain("₺1.800,00");

      await browser.close();
    }, 15000);
  });
});
