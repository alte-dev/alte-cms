import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const cookieStoreMap = new Map<string, string>();
const setCookieSpy = vi.fn((name: string, value: string) => {
  cookieStoreMap.set(name, value);
});
const deleteCookieSpy = vi.fn((name: string) => {
  cookieStoreMap.delete(name);
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const v = cookieStoreMap.get(name);
      return v !== undefined ? { name, value: v } : undefined;
    },
    set: setCookieSpy,
    delete: deleteCookieSpy,
  })),
  headers: vi.fn(async () => new Headers()),
}));

describe("Security Audit P0 Fixes (SEC-001, SEC-002, SEC-004)", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    cookieStoreMap.clear();
    setCookieSpy.mockClear();
    deleteCookieSpy.mockClear();
    process.env.INTERNAL_API_SECRET = "a-very-strong-test-internal-secret-32chars!";
    process.env.PAYLOAD_SECRET = "a-very-strong-test-payload-secret-32chars!";
    process.env.MEDUSA_BACKEND_URL = "http://127.0.0.1:9000";
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = "pk_test_123456";
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("SEC-001: Signed _order_confirmation cookie & safe getOrder", () => {
    it("signs _order_confirmation with HMAC and rejects raw/unsigned or tampered order IDs", async () => {
      const { setOrderConfirmation, getOrderConfirmation } = await import("../lib/medusa/cookies");

      // 1. Raw unsigned order ID (IDOR attack via forged cookie) MUST be rejected
      cookieStoreMap.set("_order_confirmation", "order_01JXYZ1234567890ABCDEF");
      expect(await getOrderConfirmation()).toBeUndefined();

      // 2. Tampered signature MUST be rejected
      cookieStoreMap.set("_order_confirmation", "order_01JXYZ1234567890ABCDEF.9999999999.deadbeef");
      expect(await getOrderConfirmation()).toBeUndefined();

      // 3. Server-signed cookie MUST be accepted and return clean orderId
      await setOrderConfirmation("order_01JXYZ1234567890ABCDEF");
      const rawStored = cookieStoreMap.get("_order_confirmation") || "";
      expect(rawStored).not.toBe("order_01JXYZ1234567890ABCDEF");
      expect(rawStored.split(".")).toHaveLength(3);
      expect(await getOrderConfirmation()).toBe("order_01JXYZ1234567890ABCDEF");
    });

    it("rejects path-traversal or invalid orderId in getOrder before calling Medusa", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const { getOrder } = await import("../lib/medusa/cart");
      expect(await getOrder("../admin/users")).toBeNull();
      expect(await getOrder("order_1?foo=bar")).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("blocks /api/checkout/status when cart_id does not match caller cart_id cookie (IDOR)", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      cookieStoreMap.set("cart_id", "cart_01OWN_CART_1234567890");
      const { GET } = await import("../app/api/checkout/status/route");
      const req = new NextRequest(
        "http://localhost:3100/api/checkout/status?cart_id=cart_01VICTIM_CART_999999",
      );
      const res = await GET(req);
      expect(res.status).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("SEC-004: /api/checkout/status forwards client IP and does not mark 429 as failed", () => {
    it("forwards x-alte-client-ip to Medusa and returns pending (not failed) on 429", async () => {
      const fetchSpy = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchSpy);

      process.env.TRUST_PROXY = "true";
      process.env.TRUSTED_PROXY_HOPS = "1";
      cookieStoreMap.set("cart_id", "cart_01VALID_CART_12345678");

      const { GET } = await import("../app/api/checkout/status/route");
      const req = new NextRequest(
        "http://localhost:3100/api/checkout/status?cart_id=cart_01VALID_CART_12345678",
        { headers: { "x-forwarded-for": "203.0.113.42" } },
      );

      const res = await GET(req);
      const body = await res.json();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const calledHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(calledHeaders["x-alte-client-ip"]).toBe("203.0.113.42");
      expect(body.status).toBe("pending");
      expect(body.status).not.toBe("failed");
    });
  });
});
