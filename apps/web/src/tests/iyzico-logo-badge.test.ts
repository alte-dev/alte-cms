import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockGetPaymentOptions = vi.fn();

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("img", {
      src: props.src,
      alt: props.alt,
      width: props.width,
      height: props.height,
      className: props.className,
    }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../lib/payload/content", () => ({
  getNavigation: vi.fn(async () => null),
  getSiteSettings: vi.fn(async () => ({ storeName: "Test Mağaza" })),
}));

vi.mock("../lib/medusa/cart", () => ({
  getPaymentOptions: () => mockGetPaymentOptions(),
}));

vi.mock("../components/cookie-consent/CookiePreferencesTrigger", () => ({
  CookiePreferencesTrigger: () => React.createElement("button", null, "Çerez Tercihleri"),
}));

describe("iyzico horizontal logo in Footer & CheckoutForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders iyzico logo in Footer when iyzico payment is enabled", async () => {
    mockGetPaymentOptions.mockResolvedValueOnce({
      iyzico: { enabled: true, display_mode: "redirect" },
      paytr: { enabled: false, display_mode: "iframe" },
      cod: {
        enabled: true,
        fee: 100,
        fee_label: "Kapıda Ödeme",
        max_order_amount: null,
        variant_id: null,
      },
      default_method: "iyzico",
      dev: { enabled: false },
    });

    const { Footer } = await import("../components/footer");
    const element = await Footer();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/images/iyzico-footer-band.png");
    expect(html).toContain("iyzico");
  });

  it("renders white iyzico logo in Footer when footer_logo_variant is white", async () => {
    mockGetPaymentOptions.mockResolvedValueOnce({
      iyzico: { enabled: true, display_mode: "redirect", footer_logo_variant: "white" },
      paytr: { enabled: false, display_mode: "iframe" },
      cod: {
        enabled: true,
        fee: 100,
        fee_label: "Kapıda Ödeme",
        max_order_amount: null,
        variant_id: null,
      },
      default_method: "iyzico",
      dev: { enabled: false },
    });

    const { Footer } = await import("../components/footer");
    const element = await Footer();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("/images/iyzico-footer-band-white.png");
    expect(html).not.toContain("/images/iyzico-footer-band.png");
  });

  it("does NOT render iyzico logo in Footer when iyzico payment is disabled", async () => {
    mockGetPaymentOptions.mockResolvedValueOnce({
      iyzico: { enabled: false, display_mode: "redirect" },
      paytr: { enabled: true, display_mode: "iframe" },
      cod: {
        enabled: true,
        fee: 100,
        fee_label: "Kapıda Ödeme",
        max_order_amount: null,
        variant_id: null,
      },
      default_method: "paytr",
      dev: { enabled: false },
    });

    const { Footer } = await import("../components/footer");
    const element = await Footer();
    const html = renderToStaticMarkup(element);

    expect(html).not.toContain("/images/iyzico-footer-band.png");
  });

  it("renders iyzico logo in CheckoutForm payment method option when iyzico is enabled", async () => {
    const { CheckoutForm } = await import("../components/checkout-form");
    const cart = {
      id: "cart_test_1",
      items: [
        {
          id: "item_1",
          title: "Test Ürün",
          quantity: 1,
          unit_price: 500,
          total: 500,
          variant_id: "var_1",
        },
      ],
      subtotal: 500,
      shipping_total: 0,
      discount_total: 0,
      total: 500,
    } as any;

    const html = renderToStaticMarkup(
      React.createElement(CheckoutForm, {
        initialCart: cart,
        shippingOptions: [{ id: "so_1", name: "Standart", amount: 0 }] as any,
        paymentOptions: {
          iyzico: { enabled: true, display_mode: "redirect" },
          paytr: { enabled: false, display_mode: "iframe" },
          cod: {
            enabled: true,
            fee: 100,
            fee_label: "Kapıda Ödeme Hizmet Bedeli",
            max_order_amount: null,
            variant_id: null,
          },
          default_method: "iyzico",
          dev: { enabled: false },
        },
      }),
    );

    expect(html).toContain("/images/iyzico-pay-horizontal.png");
  });

  it("does NOT render iyzico logo in CheckoutForm when iyzico is disabled", async () => {
    const { CheckoutForm } = await import("../components/checkout-form");
    const cart = {
      id: "cart_test_2",
      items: [
        {
          id: "item_1",
          title: "Test Ürün",
          quantity: 1,
          unit_price: 500,
          total: 500,
          variant_id: "var_1",
        },
      ],
      subtotal: 500,
      shipping_total: 0,
      discount_total: 0,
      total: 500,
    } as any;

    const html = renderToStaticMarkup(
      React.createElement(CheckoutForm, {
        initialCart: cart,
        shippingOptions: [{ id: "so_1", name: "Standart", amount: 0 }] as any,
        paymentOptions: {
          iyzico: { enabled: false, display_mode: "redirect" },
          paytr: { enabled: true, display_mode: "iframe" },
          cod: {
            enabled: true,
            fee: 100,
            fee_label: "Kapıda Ödeme Hizmet Bedeli",
            max_order_amount: null,
            variant_id: null,
          },
          default_method: "paytr",
          dev: { enabled: false },
        },
      }),
    );

    expect(html).not.toContain("/images/iyzico-pay-horizontal.png");
  });
});
