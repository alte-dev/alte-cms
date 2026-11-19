import { describe, expect, it, vi, beforeEach } from "vitest";
import { mapMedusaError } from "../lib/medusa/format";

describe("mapMedusaError for cart availability errors", () => {
  it("maps PRODUCT_UNPUBLISHED, PRODUCT_UNAVAILABLE, and INSUFFICIENT_STOCK cleanly", () => {
    expect(mapMedusaError(new Error('[PRODUCT_UNPUBLISHED] "Koltuk" yayında değil.'))).toContain(
      "yayında değil",
    );
    expect(mapMedusaError(new Error('[PRODUCT_UNAVAILABLE] "Koltuk" kaldırıldı.'))).toContain(
      "kaldırıldı",
    );
    expect(mapMedusaError(new Error('[INSUFFICIENT_STOCK] "Koltuk" stoğu tükendi.'))).toContain(
      "stoğu",
    );
  });
});

describe("POST /api/checkout pre-payment availability guard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const validBody = {
    email: "test@example.test",
    phone: "0500 000 00 00",
    deliveryAddress: {
      firstName: "Test",
      lastName: "User",
      city: "İstanbul",
      district: "Kadıköy",
      addressLine1: "Moda Cad. No: 1",
      postalCode: "34710",
      countryCode: "tr",
    },
    sameAsDelivery: true,
    invoiceType: "individual",
    shippingOptionId: "so_test",
    distanceSalesContract: true,
    kvkkConsent: true,
    paymentMethod: "paytr",
  };

  it("blocks PayTR payment initiation with 409 when cart has unavailable/unpublished/out-of-stock item", async () => {
    const initiatePaytrPayment = vi.fn();
    const completeCart = vi.fn();

    vi.doMock("../lib/medusa/cookies", () => ({
      getCartId: vi.fn(async () => "cart_avail_1"),
      getOrderConfirmation: vi.fn(async () => null),
      setOrderConfirmation: vi.fn(async () => {}),
      deleteCartId: vi.fn(async () => {}),
      getCustomerSessionToken: vi.fn(async () => null),
    }));

    vi.doMock("../lib/medusa/account", () => ({
      getServerCustomer: vi.fn(async () => null),
      saveCustomerAddressFromCheckout: vi.fn(async () => {}),
    }));

    vi.doMock("../lib/medusa/cart", () => ({
      getCart: vi.fn(async () => ({
        id: "cart_avail_1",
        items: [{ id: "item_1", title: "Koltuk", quantity: 1, unit_price: 1000 }],
      })),
      updateCart: vi.fn(async () => ({})),
      setCartShippingMethod: vi.fn(async () => ({})),
      addItemToCart: vi.fn(),
      removeCartItem: vi.fn(),
      assignCartToCustomer: vi.fn(),
      getPaymentOptions: vi.fn(async () => ({
        paytr: { enabled: true },
        iyzico: { enabled: false },
        cod: { enabled: false, fee: 100 },
        dev: { enabled: false },
      })),
      initiatePaytrPayment,
      initiateIyzicoPayment: vi.fn(),
      completeCart,
      isDevPaymentAllowed: vi.fn(() => false),
      validateCartAvailability: vi.fn(async () => ({
        valid: false,
        issues: [
          {
            lineItemId: "item_1",
            variantId: "var_1",
            productId: "prod_1",
            title: "Koltuk",
            reason: "unpublished",
            requestedQuantity: 1,
            availableQuantity: 0,
          },
        ],
        message: '[PRODUCT_UNPUBLISHED] "Koltuk" ürünü şu anda yayında değil.',
      })),
    }));

    const { POST } = await import("../app/api/checkout/route");
    const req = new Request("http://localhost:3100/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.code).toBe("CART_ITEM_UNAVAILABLE");
    expect(Array.isArray(data.issues)).toBe(true);
    expect(data.issues).toHaveLength(1);
    expect(initiatePaytrPayment).not.toHaveBeenCalled();
    expect(completeCart).not.toHaveBeenCalled();
  });

  it("fails closed when availability validation throws before payment initiation", async () => {
    const initiatePaytrPayment = vi.fn();

    vi.doMock("../lib/medusa/cookies", () => ({
      getCartId: vi.fn(async () => "cart_avail_2"),
      getOrderConfirmation: vi.fn(async () => null),
      setOrderConfirmation: vi.fn(async () => {}),
      deleteCartId: vi.fn(async () => {}),
      getCustomerSessionToken: vi.fn(async () => null),
    }));

    vi.doMock("../lib/medusa/account", () => ({
      getServerCustomer: vi.fn(async () => null),
      saveCustomerAddressFromCheckout: vi.fn(async () => {}),
    }));

    vi.doMock("../lib/medusa/cart", () => ({
      getCart: vi.fn(async () => ({
        id: "cart_avail_2",
        items: [{ id: "item_1", title: "Koltuk", quantity: 1, unit_price: 1000 }],
      })),
      updateCart: vi.fn(async () => ({})),
      setCartShippingMethod: vi.fn(async () => ({})),
      addItemToCart: vi.fn(),
      removeCartItem: vi.fn(),
      assignCartToCustomer: vi.fn(),
      getPaymentOptions: vi.fn(async () => ({
        paytr: { enabled: true },
        iyzico: { enabled: false },
        cod: { enabled: false, fee: 100 },
        dev: { enabled: false },
      })),
      initiatePaytrPayment,
      initiateIyzicoPayment: vi.fn(),
      completeCart: vi.fn(),
      isDevPaymentAllowed: vi.fn(() => false),
      validateCartAvailability: vi.fn(async () => {
        throw new Error("Medusa unreachable");
      }),
    }));

    const { POST } = await import("../app/api/checkout/route");
    const req = new Request("http://localhost:3100/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(initiatePaytrPayment).not.toHaveBeenCalled();
  });
});

describe("validateCartAvailability & getCartAvailabilityIssues safety", () => {
  beforeEach(() => {
    vi.doUnmock("../lib/medusa/cart");
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("rejects malformed cart IDs before issuing any network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { validateCartAvailability } = await import("../lib/medusa/cart");

    await expect(validateCartAvailability("../admin?x=1")).rejects.toThrow(
      /Geçersiz sepet kimliği/,
    );
    await expect(validateCartAvailability("cart_1")).rejects.toThrow(/Geçersiz sepet kimliği/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("logs unexpected errors in getCartAvailabilityIssues while returning an empty list for UI", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("Medusa 503 unavailable"));

    const { getCartAvailabilityIssues } = await import("../lib/medusa/cart");
    const issues = await getCartAvailabilityIssues("cart_01JABCDEF1234567890");

    expect(issues).toEqual([]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][1])).toContain("Medusa 503 unavailable");

    fetchSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
