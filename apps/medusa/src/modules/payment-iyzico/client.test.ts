import crypto from "crypto";
import { describe, expect, it, vi } from "vitest";
import {
  IyzicoClient,
  buildIyziAuthHeaderV2,
  calculateIyzicoHmacSha256,
  resolveIyzicoBaseUrl,
  stripTrailingZeros,
  validateIyzicoPaymentPageUrl,
  verifyIyzicoInitSignature,
  verifyIyzicoRetrieveSignature,
} from "./client";

describe("iyzico client & IYZWSv2 HMAC", () => {
  it("computes IYZWSv2 Authorization header matching iyzipay-node utils.js formula", () => {
    const apiKey = "sandbox-api-key-example";
    const secretKey = "sandbox-secret-key-example";
    const uriPath = "/payment/bin/check";
    const randomKey = "1722246017090123456";
    const body = JSON.stringify({
      locale: "tr",
      binNumber: "535805",
      conversationId: "docsTest-v1",
    });

    const expectedHex = crypto
      .createHmac("sha256", secretKey)
      .update(randomKey + uriPath + body)
      .digest("hex");
    const expectedBase64 = Buffer.from(
      `apiKey:${apiKey}&randomKey:${randomKey}&signature:${expectedHex}`,
    ).toString("base64");

    const header = buildIyziAuthHeaderV2({
      apiKey,
      secretKey,
      uriPath,
      requestBody: body,
      randomKey,
    });

    expect(header).toBe(`IYZWSv2 ${expectedBase64}`);
  });

  it("strips trailing zeros from decimal price strings", () => {
    expect(stripTrailingZeros("100.00")).toBe("100");
    expect(stripTrailingZeros("100.0")).toBe("100");
    expect(stripTrailingZeros("10.50")).toBe("10.5");
    expect(stripTrailingZeros(125.5)).toBe("125.5");
    expect(stripTrailingZeros(125)).toBe("125");
  });

  it("verifies CheckoutForm initialize and retrieve signatures and rejects tampering", () => {
    const secretKey = "test-secret-key";

    const initSig = calculateIyzicoHmacSha256(["conv-1", "tok-1"], secretKey);
    expect(
      verifyIyzicoInitSignature({
        conversationId: "conv-1",
        token: "tok-1",
        signature: initSig,
        secretKey,
      }),
    ).toBe(true);
    expect(
      verifyIyzicoInitSignature({
        conversationId: "conv-1",
        token: "tok-tampered",
        signature: initSig,
        secretKey,
      }),
    ).toBe(false);

    const retrieveSig = calculateIyzicoHmacSha256(
      ["SUCCESS", "pay-1", "TRY", "basket-1", "conv-1", "150", "150", "tok-1"],
      secretKey,
    );

    expect(
      verifyIyzicoRetrieveSignature({
        paymentStatus: "SUCCESS",
        paymentId: "pay-1",
        currency: "TRY",
        basketId: "basket-1",
        conversationId: "conv-1",
        paidPrice: "150.00",
        price: "150.00",
        token: "tok-1",
        signature: retrieveSig,
        secretKey,
      }),
    ).toBe(true);

    expect(
      verifyIyzicoRetrieveSignature({
        paymentStatus: "SUCCESS",
        paymentId: "pay-1",
        currency: "TRY",
        basketId: "basket-1",
        conversationId: "conv-1",
        paidPrice: "10.00",
        price: "150.00",
        token: "tok-1",
        signature: retrieveSig,
        secretKey,
      }),
    ).toBe(false);
  });

  it("resolves base URL by mode in production and rejects non-https or IYZICO_API_BASE in prod", () => {
    expect(resolveIyzicoBaseUrl("sandbox", { nodeEnv: "production" })).toBe(
      "https://sandbox-api.iyzipay.com",
    );
    expect(resolveIyzicoBaseUrl("live", { nodeEnv: "production" })).toBe("https://api.iyzipay.com");
    expect(() =>
      resolveIyzicoBaseUrl("sandbox", {
        nodeEnv: "production",
        apiBaseOverride: "http://127.0.0.1:9098",
      }),
    ).toThrow(/FAIL-CLOSED/);
    expect(
      resolveIyzicoBaseUrl("sandbox", {
        nodeEnv: "development",
        apiBaseOverride: "http://127.0.0.1:9098/",
      }),
    ).toBe("http://127.0.0.1:9098");
  });

  it("validates paymentPageUrl against allowed iyzico domains and blocks open redirects", () => {
    expect(
      validateIyzicoPaymentPageUrl("https://sandbox-cpp.iyzipay.com/checkout/abc", {
        mode: "sandbox",
        nodeEnv: "production",
      }),
    ).toBe(true);
    expect(
      validateIyzicoPaymentPageUrl("https://cpp.iyzipay.com/checkout/abc", {
        mode: "live",
        nodeEnv: "production",
      }),
    ).toBe(true);
    expect(
      validateIyzicoPaymentPageUrl("https://evil.example.test/phish", {
        mode: "live",
        nodeEnv: "production",
      }),
    ).toBe(false);
    expect(
      validateIyzicoPaymentPageUrl("http://sandbox-cpp.iyzipay.com/checkout/abc", {
        mode: "sandbox",
        nodeEnv: "production",
      }),
    ).toBe(false);
    expect(
      validateIyzicoPaymentPageUrl("javascript:alert(1)", {
        mode: "sandbox",
        nodeEnv: "development",
      }),
    ).toBe(false);
    expect(
      validateIyzicoPaymentPageUrl("http://127.0.0.1:9098/checkout/tok-1", {
        mode: "sandbox",
        nodeEnv: "development",
        apiBaseOverride: "http://127.0.0.1:9098",
      }),
    ).toBe(true);
  });

  it("does NOT retry initialize/cancel/refund on 5xx, but retries retrieve once, and sanitizes errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500,
        headers: { "content-type": "text/plain" },
      }),
    );

    const client = new IyzicoClient({
      apiKey: "secret-api-key-123",
      secretKey: "super-secret-456",
      mode: "sandbox",
      baseUrl: "http://127.0.0.1:9098",
      fetchImpl: fetchMock as any,
      timeoutMs: 1000,
    });

    let caughtError = "";
    try {
      await client.initializeCheckoutForm({
        locale: "tr",
        conversationId: "conv-1",
        price: "100.00",
        paidPrice: "100.00",
        currency: "TRY",
        basketId: "cart-1",
        callbackUrl: "http://localhost:3100/api/payment/iyzico/callback",
        enabledInstallments: [1],
        buyer: {
          id: "buyer-1",
          name: "Test",
          surname: "User",
          email: "test@example.test",
          identityNumber: "11111111111",
          registrationAddress: "Test Sokak",
          ip: "127.0.0.1",
          city: "Istanbul",
          country: "Turkey",
        },
        shippingAddress: {
          contactName: "Test User",
          city: "Istanbul",
          country: "Turkey",
          address: "Test Sokak",
        },
        billingAddress: {
          contactName: "Test User",
          city: "Istanbul",
          country: "Turkey",
          address: "Test Sokak",
        },
        basketItems: [
          {
            id: "item-1",
            name: "Urun",
            category1: "Genel",
            itemType: "PHYSICAL",
            price: "100.00",
          },
        ],
      });
    } catch (err: any) {
      caughtError = err.message;
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(caughtError).not.toContain("secret-api-key-123");
    expect(caughtError).not.toContain("super-secret-456");
    expect(caughtError).not.toContain("IYZWSv2");

    fetchMock.mockClear();
    fetchMock
      .mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: "success", paymentStatus: "SUCCESS", token: "tok-secret-999" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const retrieved = await client.retrieveCheckoutForm({
      locale: "tr",
      conversationId: "conv-1",
      token: "tok-secret-999",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retrieved.status).toBe("success");
  });

  it("rejects oversized responses exceeding maxBytes", async () => {
    const hugeBody = "x".repeat(2048);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(hugeBody, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new IyzicoClient({
      apiKey: "k",
      secretKey: "s",
      mode: "sandbox",
      baseUrl: "http://127.0.0.1:9098",
      fetchImpl: fetchMock as any,
      maxResponseBytes: 512,
    });

    await expect(
      client.retrieveCheckoutForm({ locale: "tr", conversationId: "c1", token: "t1" }),
    ).rejects.toThrow(/boyut/i);
  });
});
