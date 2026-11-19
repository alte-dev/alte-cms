import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) =>
    React.createElement("a", { href, ...rest }, children),
}));

import {
  CheckoutOrderSummaryItem,
  resolveCartItemHref,
  resolveCartItemThumbnail,
} from "../components/checkout-order-summary-item";
import { CartDrawerPanel, shouldOpenCartDrawerForPath } from "../components/cart-drawer-provider";
import { CartView } from "../components/cart-view";
import type { StoreCart, StoreCartLineItem } from "../lib/medusa/types";

const sampleItemWithThumb: StoreCartLineItem = {
  id: "item_1",
  title: "Meşe Berjer",
  product_title: "Meşe Berjer",
  product_handle: "mese-berjer",
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
      expect(html).toContain('href="/urun/mese-berjer"');
      expect(html).toContain("transition-transform");
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

    it("disables increment button when quantity reaches 99", () => {
      const maxQtyCart: StoreCart = {
        ...sampleCart,
        items: [{ ...sampleItemWithThumb, quantity: 99 }],
      };
      const html = renderToStaticMarkup(
        React.createElement(CartDrawerPanel, {
          isOpen: true,
          cart: maxQtyCart,
          freeShippingProgress: null,
          isPending: false,
          errorMsg: null,
          onClose: () => {},
          onUpdateQuantity: () => {},
          onRemoveItem: () => {},
        }),
      );

      expect(html).toMatch(
        /aria-label="Miktarı artır"[^>]*disabled=""|disabled=""[^>]*aria-label="Miktarı artır"/,
      );
    });

    it("blocks checkout link and displays warning when availabilityIssues are present", () => {
      const html = renderToStaticMarkup(
        React.createElement(CartDrawerPanel, {
          isOpen: true,
          cart: sampleCart,
          freeShippingProgress: null,
          availabilityIssues: [
            {
              lineItemId: "item_1",
              reason: "unpublished",
              requestedQuantity: 2,
              availableQuantity: 0,
            },
          ],
          isPending: false,
          errorMsg: null,
          onClose: () => {},
          onUpdateQuantity: () => {},
          onRemoveItem: () => {},
        }),
      );

      expect(html).toContain("yayında değil");
      expect(html).not.toContain('href="/odeme"');
    });

    it("displays product subtotal excluding shipping_total even if cart already has a shipping method", () => {
      const cartWithShipping: StoreCart = {
        ...sampleCart,
        items: [
          {
            ...sampleItemWithoutThumb,
            id: "item_ship_test",
            title: "Test Ürün",
            quantity: 4,
            unit_price: 150,
            subtotal: 600,
            total: 600,
          },
        ],
        subtotal: 600,
        shipping_total: 89.9,
        total: 689.9,
      };
      const html = renderToStaticMarkup(
        React.createElement(CartDrawerPanel, {
          isOpen: true,
          cart: cartWithShipping,
          freeShippingProgress: null,
          isPending: false,
          errorMsg: null,
          onClose: () => {},
          onUpdateQuantity: () => {},
          onRemoveItem: () => {},
        }),
      );

      expect(html).toContain("Toplam");
      expect(html).toContain("Vergi dahil ve kargo ücreti ödeme sırasında hesaplanır");
      expect(html).toContain("600,00");
      expect(html).not.toContain("689,90");
    });

    it("disables cart drawer on /sepet routes while keeping it enabled on storefront pages", () => {
      expect(shouldOpenCartDrawerForPath("/sepet")).toBe(false);
      expect(shouldOpenCartDrawerForPath("/sepet/detay")).toBe(false);
      expect(shouldOpenCartDrawerForPath("/")).toBe(true);
      expect(shouldOpenCartDrawerForPath("/urun/test-urun")).toBe(true);
      expect(shouldOpenCartDrawerForPath(null)).toBe(true);
    });
  });

  describe("resolveCartItemThumbnail security", () => {
    it("rejects javascript:, protocol-relative, and localhost http URLs in production", () => {
      const origEnv = process.env.NODE_ENV;
      try {
        (process.env as Record<string, string | undefined>).NODE_ENV = "production";
        expect(
          resolveCartItemThumbnail({ ...sampleItemWithThumb, thumbnail: "javascript:alert(1)" }),
        ).toBeNull();
        expect(
          resolveCartItemThumbnail({
            ...sampleItemWithThumb,
            thumbnail: "//evil.example.test/x.png",
          }),
        ).toBeNull();
        expect(
          resolveCartItemThumbnail({
            ...sampleItemWithThumb,
            thumbnail: "http://localhost:9000/static/img.jpg",
          }),
        ).toBeNull();
        expect(
          resolveCartItemThumbnail({
            ...sampleItemWithThumb,
            thumbnail: "https://cdn.example.test/berjer.jpg",
          }),
        ).toBe("https://cdn.example.test/berjer.jpg");
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
      }
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
      expect(html).toContain('href="/urun/mese-berjer"');
      expect(html).toContain("Keten Yastık");
    });
  });

  describe("resolveCartItemHref", () => {
    it("resolves /urun/<handle> safely and rejects path traversal handles", () => {
      expect(resolveCartItemHref(sampleItemWithThumb)).toBe("/urun/mese-berjer");
      expect(
        resolveCartItemHref({
          ...sampleItemWithoutThumb,
          product_handle: undefined,
          variant: { product: { handle: "keten-yastik" } } as any,
        }),
      ).toBe("/urun/keten-yastik");
      expect(resolveCartItemHref(sampleItemWithoutThumb)).toBeNull();
      expect(
        resolveCartItemHref({ ...sampleItemWithThumb, product_handle: "../admin" }),
      ).toBeNull();
    });
  });

  describe("CartDrawerPanel error state", () => {
    it("displays error alert without misleading empty-cart message when loading fails", () => {
      const html = renderToStaticMarkup(
        React.createElement(CartDrawerPanel, {
          isOpen: true,
          cart: null,
          freeShippingProgress: null,
          isPending: false,
          isLoading: false,
          errorMsg: "Sepet bilgileri yüklenemedi. Lütfen tekrar deneyin.",
          onClose: () => {},
          onUpdateQuantity: () => {},
          onRemoveItem: () => {},
        }),
      );

      expect(html).toContain("Sepet bilgileri yüklenemedi. Lütfen tekrar deneyin.");
      expect(html).not.toContain("Sepetiniz Boş");
    });
  });

  describe("Consistent pricing when cart has stale shipping_total and free shipping is eligible", () => {
    const staleShippingCart: StoreCart = {
      ...sampleCart,
      items: [
        {
          ...sampleItemWithThumb,
          quantity: 1,
          unit_price: 1595,
          subtotal: 1595,
          total: 1595,
        },
      ],
      subtotal: 1595,
      shipping_total: 89.9,
      total: 1684.9,
    };

    const freeEligible = {
      hasThreshold: true,
      isEligible: true,
      threshold: 1000,
      remaining: 0,
      percent: 100,
      message: "Tebrikler, kargonuz ücretsiz!",
    };

    it("CartView does not add stale cart.shipping_total to Toplam Tutar when free shipping is eligible", () => {
      const html = renderToStaticMarkup(
        React.createElement(CartView, {
          initialCart: staleShippingCart,
          shippingProgress: freeEligible,
        }),
      );

      expect(html).toContain("Ücretsiz");
      expect(html).toContain("Toplam");
      expect(html).toContain("*Vergiler dahil");
      expect(html).toContain("1.595,00");
      expect(html).not.toContain("1.684,90");
    });

    it("CartDrawerPanel Ara Toplam excludes stale cart.shipping_total", () => {
      const html = renderToStaticMarkup(
        React.createElement(CartDrawerPanel, {
          isOpen: true,
          cart: staleShippingCart,
          freeShippingProgress: freeEligible,
          isPending: false,
          errorMsg: null,
          onClose: () => {},
          onUpdateQuantity: () => {},
          onRemoveItem: () => {},
        }),
      );

      expect(html).toContain("1.595,00");
      expect(html).not.toContain("1.684,90");
    });
  });
});
