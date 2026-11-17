import { describe, expect, it, vi, beforeEach } from "vitest";
import { processIyzicoCallback } from "./route";
import { calculateIyzicoHmacSha256 } from "../../../../../modules/payment-iyzico/client";
import { PaymentSettingsRegistry } from "../../../../../modules/payment-settings/service";

function makeSettings() {
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
  });
}

function makeHarness(sessionOverrides: Record<string, any> = {}) {
  const session: any = {
    id: "payses_1",
    amount: 150,
    currency_code: "try",
    status: "pending",
    data: {
      token: "valid-iyz-token-123",
      conversation_id: "conv_1",
      basket_id: "cart_1",
      cart_id: "cart_1",
      expected_amount_kurus: 15000,
      mode: "sandbox",
      status: "pending",
      ...sessionOverrides,
    },
  };

  let completedCart = false;
  let completeCount = 0;

  const paymentService = {
    listPaymentCollections: vi.fn(async () => [{ payment_sessions: [session] }]),
    updatePaymentSession: vi.fn(async (upd: any) => {
      session.data = upd.data;
      return session;
    }),
    authorizePaymentSession: vi.fn(async () => session),
    listPayments: vi.fn(async () => [{ id: "pay_medusa_1", captured_at: null }]),
  };

  const cartService = {
    retrieveCart: vi.fn(async () => ({
      id: "cart_1",
      completed_at: completedCart ? new Date().toISOString() : null,
    })),
  };

  const pgConnection: any = vi.fn((table: string) => {
    if (table === "payment_session") {
      return {
        whereRaw: () => ({
          whereNull: () => ({
            select: async () => [session],
          }),
        }),
      };
    }
    if (table === "order_cart") {
      return {
        where: () => ({
          select: async () => (completedCart ? [{ order_id: "order_1" }] : []),
        }),
      };
    }
    if (table === "order") {
      return {
        where: () => ({
          select: async () => [{ id: "order_1", metadata: {} }],
          update: vi.fn(async () => 1),
        }),
      };
    }
    return {};
  });

  const completeOrder = vi.fn(async () => {
    completedCart = true;
    completeCount += 1;
    return { id: "order_1" };
  });

  const capturePayment = vi.fn(async () => {});

  return {
    session,
    paymentService,
    cartService,
    pgConnection,
    completeOrder,
    capturePayment,
    getCompleteCount: () => completeCount,
  };
}

describe("processIyzicoCallback", () => {
  beforeEach(() => {
    PaymentSettingsRegistry.invalidate();
    makeSettings();
  });

  it("rejects tampered signature and does not complete cart", async () => {
    const h = makeHarness();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          paymentStatus: "SUCCESS",
          paymentId: "iyz_pay_1",
          currency: "TRY",
          basketId: "cart_1",
          conversationId: "conv_1",
          paidPrice: "150.00",
          price: "150.00",
          token: "valid-iyz-token-123",
          signature: "tampered-signature",
        }),
        { status: 200 },
      ),
    );

    const res = await processIyzicoCallback(
      { token: "valid-iyz-token-123" },
      { ...h, fetchImpl: fetchMock as any },
    );

    expect(res.status).toBe("failed");
    expect(h.getCompleteCount()).toBe(0);
    expect(h.session.data.status).toBe("failed");
  });

  it("rejects paidPrice mismatch or currency !== TRY", async () => {
    const h = makeHarness();
    const sig = calculateIyzicoHmacSha256(
      ["SUCCESS", "iyz_pay_1", "TRY", "cart_1", "conv_1", "100", "100", "valid-iyz-token-123"],
      "sandbox-secret-test",
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          paymentStatus: "SUCCESS",
          paymentId: "iyz_pay_1",
          currency: "TRY",
          basketId: "cart_1",
          conversationId: "conv_1",
          paidPrice: "100.00",
          price: "100.00",
          token: "valid-iyz-token-123",
          signature: sig,
        }),
        { status: 200 },
      ),
    );

    const res = await processIyzicoCallback(
      { token: "valid-iyz-token-123" },
      { ...h, fetchImpl: fetchMock as any },
    );

    expect(res.status).toBe("failed");
    expect(h.getCompleteCount()).toBe(0);
  });

  it("rejects conversationId / basketId mismatch", async () => {
    const h = makeHarness();
    const sig = calculateIyzicoHmacSha256(
      ["SUCCESS", "iyz_pay_1", "TRY", "other_cart", "conv_1", "150", "150", "valid-iyz-token-123"],
      "sandbox-secret-test",
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          paymentStatus: "SUCCESS",
          paymentId: "iyz_pay_1",
          currency: "TRY",
          basketId: "other_cart",
          conversationId: "conv_1",
          paidPrice: "150.00",
          price: "150.00",
          token: "valid-iyz-token-123",
          signature: sig,
        }),
        { status: 200 },
      ),
    );

    const res = await processIyzicoCallback(
      { token: "valid-iyz-token-123" },
      { ...h, fetchImpl: fetchMock as any },
    );

    expect(res.status).toBe("failed");
    expect(h.getCompleteCount()).toBe(0);
  });

  it("completes order once and is idempotent on concurrent/duplicate callbacks", async () => {
    const h = makeHarness();
    const sig = calculateIyzicoHmacSha256(
      ["SUCCESS", "iyz_pay_1", "TRY", "cart_1", "conv_1", "150", "150", "valid-iyz-token-123"],
      "sandbox-secret-test",
    );
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            status: "success",
            paymentStatus: "SUCCESS",
            paymentId: "iyz_pay_1",
            currency: "TRY",
            basketId: "cart_1",
            conversationId: "conv_1",
            paidPrice: "150.00",
            price: "150.00",
            token: "valid-iyz-token-123",
            signature: sig,
            itemTransactions: [{ itemId: "li_1", paymentTransactionId: "ptx_1" }],
          }),
          { status: 200 },
        ),
    );

    const [r1, r2] = await Promise.all([
      processIyzicoCallback(
        { token: "valid-iyz-token-123" },
        { ...h, fetchImpl: fetchMock as any },
      ),
      processIyzicoCallback(
        { token: "valid-iyz-token-123" },
        { ...h, fetchImpl: fetchMock as any },
      ),
    ]);

    expect(r1.status).toBe("completed");
    expect(r2.status).toBe("completed");
    expect(h.getCompleteCount()).toBe(1);
    expect(h.session.data.consumed_at).toBeTruthy();
    expect(h.session.data.iyzico_payment_id).toBe("iyz_pay_1");
    expect(h.session.data.iyzico_payment_transaction_ids).toEqual(["ptx_1"]);
  });
});
