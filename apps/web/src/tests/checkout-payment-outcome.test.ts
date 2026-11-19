import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../app/(store)/actions", () => ({
  applyCouponAction: vi.fn(),
  removeCouponAction: vi.fn(),
}));

import { CheckoutForm, validateCheckoutFormFields } from "../components/checkout-form";
import { resolveCheckoutPaymentOutcome } from "../lib/medusa/checkout-pricing";
import type { PaymentOptionsResult } from "../lib/medusa/cart";
import type { StoreCart, StoreProduct, StoreShippingOption } from "../lib/medusa/types";

describe("CheckoutForm 3-Method Single-Button & Outcome Dispatch", () => {
  const baseCart: StoreCart = {
    id: "cart_1",
    region_id: "reg_tr",
    currency_code: "try",
    total: 350,
    subtotal: 291.67,
    item_subtotal: 291.67,
    tax_total: 58.33,
    discount_total: 0,
    shipping_total: 0,
    items: [
      {
        id: "li_1",
        title: "Örnek Ürün",
        product_id: "prod_1",
        variant_id: "var_1",
        quantity: 1,
        unit_price: 350,
        subtotal: 291.67,
        tax_total: 58.33,
        total: 350,
      },
    ],
  };

  const shippingOptions: StoreShippingOption[] = [
    {
      id: "so_std",
      name: "Standart Kargo",
      price_type: "flat",
      amount: 50,
    },
  ];

  const paymentOptions: PaymentOptionsResult = {
    default_method: "iyzico",
    iyzico: { enabled: true, mode: "sandbox", display_mode: "redirect" },
    paytr: { enabled: true, display_mode: "iframe" },
    cod: {
      enabled: true,
      fee: 100,
      fee_label: "Kapıda Ödeme Hizmet Bedeli",
      max_order_amount: null,
    },
    dev: { enabled: false },
  };

  const recommendedProducts: StoreProduct[] = [
    {
      id: "prod_rec_1",
      title: "Önerilen Şal",
      handle: "onerilen-sal",
      status: "published",
      created_at: "2026-01-01T00:00:00Z",
      variants: [
        {
          id: "var_rec_1",
          title: "Standart",
          sku: "SKU-REC-1",
          manage_inventory: true,
          inventory_quantity: 5,
          allow_backorder: false,
          calculated_price: {
            calculated_amount: 150,
            original_amount: 150,
            currency_code: "try",
          },
        },
      ],
    },
  ];

  it("dispatches each of the 3 payment methods (iyzico, paytr, cod) to the right outcome", () => {
    expect(
      resolveCheckoutPaymentOutcome({
        paymentMethod: "iyzico",
        paymentPageUrl: "https://sandbox-cpp.iyzipay.com/checkout/abc",
        displayMode: "redirect",
      }),
    ).toEqual({
      kind: "redirect",
      url: "https://sandbox-cpp.iyzipay.com/checkout/abc",
    });

    expect(
      resolveCheckoutPaymentOutcome({
        paymentMethod: "iyzico",
        paymentPageUrl: "https://sandbox-cpp.iyzipay.com/checkout/abc",
        displayMode: "embedded",
      }),
    ).toEqual({
      kind: "iyzico_iframe",
      url: "https://sandbox-cpp.iyzipay.com/checkout/abc",
    });

    expect(
      resolveCheckoutPaymentOutcome({
        paymentMethod: "paytr",
        iframeUrl: "https://www.paytr.com/odeme/guvenli/token123",
        displayMode: "iframe",
      }),
    ).toEqual({
      kind: "paytr_iframe",
      url: "https://www.paytr.com/odeme/guvenli/token123",
    });

    expect(
      resolveCheckoutPaymentOutcome({
        paymentMethod: "paytr",
        iframeUrl: "https://www.paytr.com/odeme/guvenli/token123",
        displayMode: "redirect",
      }),
    ).toEqual({
      kind: "redirect",
      url: "https://www.paytr.com/odeme/guvenli/token123",
    });

    expect(
      resolveCheckoutPaymentOutcome({
        paymentMethod: "cod",
        redirectUrl: "/siparis-onay",
      }),
    ).toEqual({
      kind: "redirect",
      url: "/siparis-onay",
    });
  });

  it("renders a single confirm button, all 3 payment methods, login link, and upsell + Ekle", () => {
    const html = renderToStaticMarkup(
      React.createElement(CheckoutForm, {
        initialCart: baseCart,
        shippingOptions,
        paymentOptions,
        initialCustomer: null,
        recommendedProducts,
      }),
    );

    // Single confirm button (no duplicate right-column confirm button)
    const confirmMatches =
      html.match(
        /iyzico Güvenli Ödemeye Geç|PayTR Güvenli Ödemeye Geç|Siparişi Onayla ve Tamamla/g,
      ) || [];
    expect(confirmMatches).toHaveLength(1);
    expect(confirmMatches[0]).toBe("iyzico Güvenli Ödemeye Geç");

    // All 3 payment methods present
    expect(html).toContain('value="iyzico"');
    expect(html).toContain('value="paytr"');
    expect(html).toContain('value="cod"');

    // Guest login link with redirect=/odeme
    expect(html).toContain("/hesap/giris?redirect=/odeme");

    // Upsell product & + Ekle button
    expect(html).toContain("Önerilen Şal");
    expect(html).toContain("Ekle");
  });

  it("hides disabled payment methods completely instead of showing greyed-out options", () => {
    const html = renderToStaticMarkup(
      React.createElement(CheckoutForm, {
        initialCart: baseCart,
        shippingOptions,
        paymentOptions: {
          ...paymentOptions,
          paytr: { ...paymentOptions.paytr, enabled: false },
          cod: { ...paymentOptions.cod, enabled: false },
        },
        initialCustomer: null,
        recommendedProducts: [],
      }),
    );

    expect(html).toContain('value="iyzico"');
    expect(html).not.toContain('value="paytr"');
    expect(html).not.toContain("PayTR");
    expect(html).not.toContain('value="cod"');
    expect(html).not.toContain("Şu anda kullanılamıyor");
    expect(html).toMatch(/novalidate/i);
  });

  it("maps Zod checkout validation errors to DOM field IDs in top-to-bottom order for smooth scrolling", () => {
    const res = validateCheckoutFormFields({
      email: "gecersiz",
      phone: "123",
      deliveryAddress: {
        firstName: "",
        lastName: "",
        city: "İstanbul",
        district: "",
        addressLine1: "kısa",
        countryCode: "tr",
      },
      sameAsDelivery: true,
      invoiceType: "individual",
      shippingOptionId: "so_std",
      paymentMethod: "iyzico",
      distanceSalesContract: false,
      kvkkConsent: false,
    });

    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.firstErrorFieldId).toBe("email");
      expect(res.errors.email).toBeDefined();
      expect(res.errors.phone).toBeDefined();
      expect(res.errors.firstName).toBeDefined();
      expect(res.errors.lastName).toBeDefined();
      expect(res.errors.district).toBeDefined();
      expect(res.errors.addressLine1).toBeDefined();
      expect(res.errors.distanceSalesContract).toBeDefined();
      expect(res.errors.kvkkConsent).toBeDefined();
    }
  });
});
