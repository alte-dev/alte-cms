import { describe, it, expect, vi } from "vitest";
import {
  CheckoutConcurrencyGuard,
  COMPLETED_CART_TTL_MS,
  COMPLETED_CART_MAX_ENTRIES,
} from "../lib/medusa/cart-checkout-guard";

describe("CheckoutConcurrencyGuard (TTL, Max Size Eviction, and Finally Cleanup)", () => {
  it("exports default 1 hour TTL and 5000 max entries constants", () => {
    expect(COMPLETED_CART_TTL_MS).toBe(60 * 60 * 1000);
    expect(COMPLETED_CART_MAX_ENTRIES).toBe(5000);
  });

  it("evicts expired completedCartOrders entries after TTL elapses", () => {
    let currentTime = 1_000_000;
    const guard = new CheckoutConcurrencyGuard({
      ttlMs: 3_600_000,
      maxEntries: 5000,
      now: () => currentTime,
    });

    guard.markCompleted("cart_1", "order_1");
    expect(guard.getCompletedOrderId("cart_1")).toBe("order_1");
    expect(guard.hasCompleted("cart_1")).toBe(true);

    // Advance time just before TTL
    currentTime += 3_599_999;
    expect(guard.getCompletedOrderId("cart_1")).toBe("order_1");

    // Advance time past TTL (1 hour + 1 ms)
    currentTime += 2;
    expect(guard.getCompletedOrderId("cart_1")).toBeUndefined();
    expect(guard.hasCompleted("cart_1")).toBe(false);
    expect(guard.completedSize()).toBe(0);
  });

  it("evicts the oldest entry when maxEntries capacity is exceeded", () => {
    const currentTime = 1_000_000;
    const guard = new CheckoutConcurrencyGuard({
      ttlMs: 3_600_000,
      maxEntries: 3,
      now: () => currentTime,
    });

    guard.markCompleted("cart_1", "order_1");
    guard.markCompleted("cart_2", "order_2");
    guard.markCompleted("cart_3", "order_3");
    expect(guard.completedSize()).toBe(3);

    // Adding a 4th entry must evict the oldest ("cart_1")
    guard.markCompleted("cart_4", "order_4");
    expect(guard.completedSize()).toBe(3);
    expect(guard.getCompletedOrderId("cart_1")).toBeUndefined();
    expect(guard.getCompletedOrderId("cart_2")).toBe("order_2");
    expect(guard.getCompletedOrderId("cart_3")).toBe("order_3");
    expect(guard.getCompletedOrderId("cart_4")).toBe("order_4");
  });

  it("enforces maxEntries = 5000 by default and evicts oldest entries beyond 5000", () => {
    const guard = new CheckoutConcurrencyGuard();
    for (let i = 1; i <= 5005; i++) {
      guard.markCompleted(`cart_${i}`, `order_${i}`);
    }
    expect(guard.completedSize()).toBe(5000);
    expect(guard.getCompletedOrderId("cart_1")).toBeUndefined();
    expect(guard.getCompletedOrderId("cart_5")).toBeUndefined();
    expect(guard.getCompletedOrderId("cart_6")).toBe("order_6");
    expect(guard.getCompletedOrderId("cart_5005")).toBe("order_5005");
  });

  it("always cleans up inFlightCartCheckouts in finally even when the handler throws", async () => {
    const guard = new CheckoutConcurrencyGuard();

    await expect(
      guard.runExclusive("cart_err", async () => {
        expect(guard.isInFlight("cart_err")).toBe(true);
        throw new Error("Simulated checkout failure");
      }),
    ).rejects.toThrow("Simulated checkout failure");

    // Lock must be released in finally
    expect(guard.isInFlight("cart_err")).toBe(false);

    // A subsequent retry must be able to acquire the lock
    const result = await guard.runExclusive("cart_err", async () => {
      expect(guard.isInFlight("cart_err")).toBe(true);
      return "recovered";
    });
    expect(result).toBe("recovered");
    expect(guard.isInFlight("cart_err")).toBe(false);
  });

  it("cleans up inFlightCartCheckouts in POST /api/checkout finally block when getCart throws", async () => {
    vi.resetModules();
    vi.doMock("../lib/medusa/cookies", () => ({
      getCartId: vi.fn(async () => "cart_route_test"),
      getOrderConfirmation: vi.fn(async () => null),
      setOrderConfirmation: vi.fn(async () => {}),
      deleteCartId: vi.fn(async () => {}),
    }));
    vi.doMock("../lib/medusa/cart", () => ({
      getCart: vi.fn(async () => {
        throw new Error("Medusa connection failed");
      }),
      updateCart: vi.fn(),
      setCartShippingMethod: vi.fn(),
      addItemToCart: vi.fn(),
      removeCartItem: vi.fn(),
      getPaymentOptions: vi.fn(),
      initiatePaytrPayment: vi.fn(),
      completeCart: vi.fn(),
      isDevPaymentAllowed: vi.fn(() => true),
    }));

    const { POST } = await import("../app/api/checkout/route");
    const { defaultCheckoutGuard } = await import("../lib/medusa/cart-checkout-guard");

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
      paymentMethod: "dev",
    };

    const req = new Request("http://localhost:3100/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(defaultCheckoutGuard.isInFlight("cart_route_test")).toBe(false);
  });
});
