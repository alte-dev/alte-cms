import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement("a", { href, ...rest }, children),
}));

import { CheckoutOrderSummaryItem } from "../components/checkout-order-summary-item";
import { CartDrawerPanel } from "../components/cart-drawer-provider";
import { CartView } from "../components/cart-view";
import type { StoreCart, StoreCartLineItem } from "../lib/medusa/types";

const sampleItemWithThumb: StoreCartLineItem = {
  id: "item_1",
  title: "Meşe Berjer",
  product_title: "Meşe Berjer",
  variant_title: "Kadife / Gece Mavisi",
  thumbnail: "https://cdn.example.test/berjer.jpg",
  quantity: 2,
  unit_price: 14370,
  subtotal: 28740,
  tax_total: 4790,
  total: 28740,
};

const sampleItemWithoutThumb: StoreCartLineItem = {
  id: "item_2",
  title: "Keten Yastık",
  variant_title: "Default Variant",
  thumbnail: null,
  quantity: 1,
  unit_price: 450,
  subtotal: 450,
  tax_total: 75,
  total: 450,
};

const sampleCart: StoreCart = {
  id: "cart_1",
  currency_code: "try",
  region_id: "reg_tr",
  items: [sampleItemWithThumb, sampleItemWithoutThumb],
  subtotal: 29190,
  shipping_total: 0,
  tax_total: 4865,
  total: 29190,
};

describe("Checkout Order Summary & Cart Drawer UX", () => {
  describe("CheckoutOrderSummaryItem (Normod/Shopify 64x64 thumbnail + badge)", () => {
    it("renders 64x64 (w-16 h-16) product thumbnail and quantity badge", () => {
      const html = renderToStaticMarkup(
        React.createElement(CheckoutOrderSummaryItem, { item: sampleItemWithThumb }),
      );

      expect(html).toContain("w-16 h-16");
      expect(html).toContain('src="https://cdn.example.test/berjer.jpg"');
      expect(html).toContain("Meşe Berjer");
      expect(html).toContain("Kadife / Gece Mavisi");
      expect(html).toContain(">2<");
    });

    it("falls back to PlaceholderImage when item has no thumbnail and hides Default Variant", () => {
      const html = renderToStaticMarkup(
        React.createElement(CheckoutOrderSummaryItem, { item: sampleItemWithoutThumb }),
      );

      expect(html).toContain("w-16 h-16");
      expect(html).not.toContain("<img");
      expect(html).not.toContain("Default Variant");
      expect(html).toContain("Keten Yastık");
    });
  });

  describe("CartDrawerPanel (Slide-over Cart)", () => {
    it("renders product thumbnails, quantity steppers, total, and checkout/cart links", () => {
      const html = renderToStaticMarkup(
        React.createElement(CartDrawerPanel, {
          isOpen: true,
          cart: sampleCart,
          freeShippingProgress: {
            hasThreshold: true,
            isEligible: true,
            threshold: 1000,
            remaining: 0,
            percent: 100,
            message: "Ücretsiz kargo kazandınız!",
          },
          isPending: false,
          errorMsg: null,
          onClose: () => {},
          onUpdateQuantity: () => {},
          onRemoveItem: () => {},
        }),
      );

      expect(html).toContain("Sepet");
      expect(html).toContain('src="https://cdn.example.test/berjer.jpg"');
      expect(html).toContain("Kadife / Gece Mavisi");
      expect(html).toContain('aria-label="Miktarı azalt"');
      expect(html).toContain('aria-label="Miktarı artır"');
      expect(html).toContain('href="/odeme"');
      expect(html).toContain('href="/sepet"');
      expect(html).toContain("Ödemeye Geç");
      expect(html).toContain("Sepete Git");
    });

    it("renders empty state when cart has no items", () => {
      const html = renderToStaticMarkup(
        React.createElement(CartDrawerPanel, {
          isOpen: true,
          cart: { ...sampleCart, items: [] },
          freeShippingProgress: null,
          isPending: false,
          errorMsg: null,
          onClose: () => {},
          onUpdateQuantity: () => {},
          onRemoveItem: () => {},
        }),
      );

      expect(html).toContain("Sepetiniz Boş");
      expect(html).toContain('href="/urunler"');
    });
  });

  describe("CartView (/sepet page thumbnails)", () => {
    it("renders real product thumbnail when available and falls back to PlaceholderImage", () => {
      const html = renderToStaticMarkup(
        React.createElement(CartView, {
          initialCart: sampleCart,
          shippingProgress: {
            hasThreshold: false,
            isEligible: false,
            threshold: 0,
            remaining: 0,
            percent: 0,
            message: "",
          },
        }),
      );

      expect(html).toContain('src="https://cdn.example.test/berjer.jpg"');
      expect(html).toContain("Keten Yastık");
    });
  });
});
