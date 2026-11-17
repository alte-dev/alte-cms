import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("../lib/medusa/cookies", () => ({
  setOrderConfirmation: vi.fn(async () => {}),
}));
import { POST as iyzicoCallbackPost, isAllowedIyzicoRedirectUrl } from "../app/api/payment/iyzico/callback/route";

describe("iyzico web callback & redirect URL validation", () => {
  beforeEach(() => {
    process.env.MEDUSA_INTERNAL_SECRET = "test-internal-secret";
    process.env.MEDUSA_BACKEND_URL = "http://127.0.0.1:9000";
    process.env.NEXT_PUBLIC_SERVER_URL = "http://localhost:3100";
  });

  it("rejects non-form-urlencoded requests with 415", async () => {
    const req = new Request("http://localhost:3100/api/payment/iyzico/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "abc" }),
    });

    const res = await iyzicoCallbackPost(req);
    expect(res.status).toBe(415);
  });

  it("rejects empty or overly long token with 400", async () => {
    const reqEmpty = new Request("http://localhost:3100/api/payment/iyzico/callback", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "token=",
    });
    expect((await iyzicoCallbackPost(reqEmpty)).status).toBe(400);

    const reqLong = new Request("http://localhost:3100/api/payment/iyzico/callback", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `token=${"a".repeat(300)}`,
    });
    expect((await iyzicoCallbackPost(reqLong)).status).toBe(400);
  });

  it("forwards valid token to Medusa internal callback with x-alte-internal and returns 303 to /odeme/sonuc", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ status: "completed", cart_id: "cart_xyz", order_id: "order_1" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const req = new Request("http://localhost:3100/api/payment/iyzico/callback", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "token=iyz-tok-valid-123",
    });

    const res = await iyzicoCallbackPost(req);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3100/odeme/sonuc?cart_id=cart_xyz");
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:9000/internal/payment/iyzico/callback",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-alte-internal": "test-internal-secret",
        }),
      }),
    );

    fetchSpy.mockRestore();
  });

  it("validates iyzico redirect URLs against allowed hosts", () => {
    expect(isAllowedIyzicoRedirectUrl("https://sandbox-cpp.iyzipay.com/checkout/1", "production")).toBe(true);
    expect(isAllowedIyzicoRedirectUrl("https://cpp.iyzipay.com/checkout/1", "production")).toBe(true);
    expect(isAllowedIyzicoRedirectUrl("https://evil.example.test/phish", "production")).toBe(false);
    expect(isAllowedIyzicoRedirectUrl("http://sandbox-cpp.iyzipay.com/checkout/1", "production")).toBe(false);
  });
});
