import { describe, expect, it, vi, beforeEach } from "vitest";
import IyzicoPaymentService from "./service";
import { calculateIyzicoHmacSha256 } from "./client";
import { PaymentSettingsRegistry } from "../payment-settings/service";
import {
  CERTIFIED_PAYMENT_PROVIDERS,
  assertProductionPaymentSecurity,
  assertUndefinedInProduction,
} from "../payment-guard/service";

function setValidSettings(overrides: Record<string, any> = {}) {
  PaymentSettingsRegistry.set({
    id: "ps_default",
    paytr_enabled: false,
    paytr_mode: "sandbox",
    paytr_merchant_id: "",
    paytr_merchant_key: "",
    paytr_merchant_salt: "",
    paytr_display_mode: "iframe",
    paytr_no_installment: false,
    paytr_max_installment: 0,
    paytr_timeout_limit: 30,
    paytr_lang: "tr",
    iyzico_enabled: true,
    iyzico_mode: "sandbox",
    iyzico_api_key: "sandbox-key-test",
    iyzico_secret_key: "sandbox-secret-test",
    iyzico_display_mode: "redirect",
    iyzico_max_installment: 1,
    iyzico_lang: "tr",
    default_payment_method: "iyzico",
    cod_enabled: false,
    cod_fee: 100,
    cod_fee_label: "Kapıda Ödeme Hizmet Bedeli",
    cod_max_order_amount: null,
    ...overrides,
  });
}

describe("IyzicoPaymentService & payment-guard", () => {
  beforeEach(() => {
    PaymentSettingsRegistry.invalidate();
    delete process.env.IYZICO_API_BASE;
  });

  it("includes pp_iyzico_iyzico in CERTIFIED_PAYMENT_PROVIDERS and blocks IYZICO_API_BASE in prod", () => {
    expect(CERTIFIED_PAYMENT_PROVIDERS).toContain("pp_iyzico_iyzico");
    expect(() =>
      assertProductionPaymentSecurity(
        [{ regionId: "reg_tr", providerId: "pp_iyzico_iyzico" }],
        "production",
      ),
    ).not.toThrow();

    process.env.IYZICO_API_BASE = "http://127.0.0.1:9098";
    expect(() => assertUndefinedInProduction("production")).toThrow(/IYZICO_API_BASE/);
    delete process.env.IYZICO_API_BASE;
  });

  it("fails closed when iyzico is disabled or credentials are missing", async () => {
    setValidSettings({ iyzico_enabled: false });
    const svc = new IyzicoPaymentService({}, {});
    await expect(
      svc.initiatePayment({
        amount: 100,
        currency_code: "try",
        context: { cart_id: "cart_1" },
      } as any),
    ).rejects.toThrow(/aktif değildir/i);

    setValidSettings({ iyzico_enabled: true, iyzico_api_key: "" });
    await expect(
      svc.initiatePayment({
        amount: 100,
        currency_code: "try",
        context: { cart_id: "cart_1" },
      } as any),
    ).rejects.toThrow(/eksik/i);
  });

  it("initializes CheckoutForm with server amount, basket sum === price, placeholder TCKN, and validates paymentPageUrl", async () => {
    setValidSettings();
    let capturedBody: any = null;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      const token = "iyz-tok-12345";
      const signature = calculateIyzicoHmacSha256(
        [capturedBody.conversationId, token],
        "sandbox-secret-test",
      );
      return new Response(
        JSON.stringify({
          status: "success",
          token,
          conversationId: capturedBody.conversationId,
          paymentPageUrl: "https://sandbox-cpp.iyzipay.com/checkout/iyz-tok-12345",
          signature,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const svc = new IyzicoPaymentService({}, { fetchImpl: fetchMock });
    const out = await svc.initiatePayment({
      amount: 250.5,
      currency_code: "try",
      context: {
        cart_id: "cart_abc",
        ip: "198.51.100.10",
        email: "customer@example.test",
        billing_address: {
          first_name: "Ali",
          last_name: "Yılmaz",
          address_1: "Test Mah. 1",
          city: "İstanbul",
          postal_code: "34000",
        },
        items: [{ id: "li_1", title: "Kahve", unit_price: 200.5, quantity: 1 }],
      },
    } as any);

    expect(capturedBody.price).toBe("250.50");
    expect(capturedBody.paidPrice).toBe("250.50");
    expect(capturedBody.currency).toBe("TRY");
    expect(capturedBody.buyer.identityNumber).toBe("11111111111");
    expect(capturedBody.buyer.ip).toBe("198.51.100.10");

    const basketSum = capturedBody.basketItems.reduce(
      (sum: number, item: any) => sum + Math.round(Number(item.price) * 100),
      0,
    );
    expect(basketSum).toBe(25050);

    expect((out.data as any).token).toBe("iyz-tok-12345");
    expect((out.data as any).display_mode).toBe("redirect");
    expect((out.data as any).expected_amount_kurus).toBe(25050);
  });

  it("rejects untrusted paymentPageUrl returned by gateway (open redirect protection)", async () => {
    setValidSettings();
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          status: "success",
          token: "tok-1",
          conversationId: body.conversationId,
          paymentPageUrl: "https://evil.example.test/steal",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const svc = new IyzicoPaymentService({}, { fetchImpl: fetchMock });
    await expect(
      svc.initiatePayment({
        amount: 100,
        currency_code: "try",
        context: { cart_id: "cart_1" },
      } as any),
    ).rejects.toThrow(/güvenilir/i);
  });

  it("supports partial refundPayment and throws on gateway failure", async () => {
    setValidSettings();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "success", paymentTransactionId: "tx_1" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "failure", errorMessage: "Yetersiz" }), {
          status: 200,
        }),
      );

    const svc = new IyzicoPaymentService({}, { fetchImpl: fetchMock });
    const ok = await svc.refundPayment({
      amount: 50,
      data: {
        iyzico_payment_id: "pay_1",
        iyzico_payment_transaction_ids: ["tx_1"],
        conversation_id: "conv_1",
      },
    } as any);
    expect((ok.data as any).last_refund_amount).toBe(50);

    await expect(
      svc.refundPayment({
        amount: 50,
        data: {
          iyzico_payment_id: "pay_1",
          iyzico_payment_transaction_ids: ["tx_1"],
          conversation_id: "conv_1",
        },
      } as any),
    ).rejects.toThrow(/iade/i);
  });

  it("reads buyer email, addresses, ip, and items from input.data on guest checkout without leaking PII into session data", async () => {
    setValidSettings();
    let capturedBody: any = null;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      const token = "iyz-guest-tok";
      const signature = calculateIyzicoHmacSha256(
        [capturedBody.conversationId, token],
        "sandbox-secret-test",
      );
      return new Response(
        JSON.stringify({
          status: "success",
          token,
          conversationId: capturedBody.conversationId,
          paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=iyz-guest-tok&lang=tr",
          signature,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const svc = new IyzicoPaymentService({}, { fetchImpl: fetchMock });
    const out = await svc.initiatePayment({
      amount: 320,
      currency_code: "try",
      context: {},
      data: {
        cart_id: "cart_guest_1",
        email: "misafir@example.com",
        ip: "203.0.113.42",
        billing_address: {
          first_name: "Deniz",
          last_name: "Kaya",
          phone: "+905551112233",
          address_1: "Ornek Mah. 5",
          city: "Ankara",
          postal_code: "06100",
        },
        shipping_address: {
          first_name: "Deniz",
          last_name: "Kaya",
          address_1: "Teslimat Sok. 9",
          city: "Izmir",
          postal_code: "35000",
        },
        items: [{ id: "li_guest_1", title: "Kupa", unit_price: 250, quantity: 1 }],
      },
    } as any);

    expect(capturedBody.buyer.email).toBe("misafir@example.com");
    expect(capturedBody.buyer.name).toBe("Deniz");
    expect(capturedBody.buyer.surname).toBe("Kaya");
    expect(capturedBody.buyer.gsmNumber).toBe("+905551112233");
    expect(capturedBody.buyer.city).toBe("Ankara");
    expect(capturedBody.buyer.ip).toBe("203.0.113.42");
    expect(capturedBody.shippingAddress.city).toBe("Izmir");
    expect(capturedBody.shippingAddress.address).toBe("Teslimat Sok. 9");
    expect(capturedBody.basketItems[0]).toMatchObject({
      id: "li_guest_1",
      name: "Kupa",
      price: "250.00",
    });

    // Ensure session data never persists customer PII
    const sessionData = out.data as Record<string, unknown>;
    expect(sessionData.email).toBeUndefined();
    expect(sessionData.billing_address).toBeUndefined();
    expect(sessionData.shipping_address).toBeUndefined();
    expect(sessionData.ip).toBeUndefined();
    expect(sessionData.cart_id).toBe("cart_guest_1");
  });

  it("uses an iyzico-accepted fallback email domain when email is omitted", async () => {
    setValidSettings();
    let capturedBody: any = null;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      const token = "iyz-fallback-tok";
      const signature = calculateIyzicoHmacSha256(
        [capturedBody.conversationId, token],
        "sandbox-secret-test",
      );
      return new Response(
        JSON.stringify({
          status: "success",
          token,
          conversationId: capturedBody.conversationId,
          paymentPageUrl: "https://sandbox-cpp.iyzipay.com?token=iyz-fallback-tok&lang=tr",
          signature,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const svc = new IyzicoPaymentService({}, { fetchImpl: fetchMock });
    await svc.initiatePayment({
      amount: 100,
      currency_code: "try",
      context: {},
      data: { cart_id: "cart_no_email" },
    } as any);

    expect(capturedBody.buyer.email).not.toMatch(/\.test$/i);
    expect(capturedBody.buyer.email).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i);
  });
});
