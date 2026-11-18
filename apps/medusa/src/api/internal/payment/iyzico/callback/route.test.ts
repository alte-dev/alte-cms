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

function makeHarness(
  sessionOverrides: Record<string, any> = {},
  opts: { sessionMissing?: boolean; deletedSession?: boolean } = {},
) {
  const session: any = {
    id: "payses_1",
    amount: 150,
    currency_code: "try",
    status: "pending",
    deleted_at: opts.deletedSession ? new Date().toISOString() : null,
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
  const orphanRows: any[] = [];

  const paymentService = {
    listPaymentCollections: vi.fn(async () =>
      opts.sessionMissing || opts.deletedSession ? [] : [{ payment_sessions: [session] }],
    ),
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
            select: async () => (opts.sessionMissing || opts.deletedSession ? [] : [session]),
          }),
          orderBy: () => ({
            limit: async () => (opts.sessionMissing ? [] : [session]),
          }),
        }),
      };
    }
    if (table === "orphan_payment") {
      return {
        insert: (row: any) => ({
          onConflict: () => ({
            ignore: async () => {
              if (!orphanRows.some((r) => r.token_hash === row.token_hash)) {
                orphanRows.push(row);
              }
            },
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
    orphanRows,
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
    expect(h.session.data.needs_manual_refund).toBe(true);
    expect(h.session.data.manual_refund_reason).toBe("INVALID_SIGNATURE");
    expect(h.session.data.iyzico_payment_id).toBe("iyz_pay_1");
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
    expect(h.session.data.needs_manual_refund).toBe(true);
    expect(h.session.data.manual_refund_reason).toBe("AMOUNT_MISMATCH");
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
    expect(h.session.data.needs_manual_refund).toBe(true);
    expect(h.session.data.manual_refund_reason).toBe("SESSION_MISMATCH");
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

  it("does NOT mark needs_manual_refund when iyzico paymentStatus is FAILURE", async () => {
    const h = makeHarness();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "success",
          paymentStatus: "FAILURE",
          errorCode: "10051",
          errorMessage: "Yetersiz bakiye",
        }),
        { status: 200 },
      ),
    );

    const res = await processIyzicoCallback(
      { token: "valid-iyz-token-123" },
      { ...h, fetchImpl: fetchMock as any },
    );

    expect(res.status).toBe("failed");
    expect(h.session.data.needs_manual_refund).toBeFalsy();
  });

  it("records orphan_payment once when session was deleted (cart mutated) and iyzico succeeded, but ignores fake tokens", async () => {
    const h = makeHarness({}, { deletedSession: true });
    const sig = calculateIyzicoHmacSha256(
      [
        "SUCCESS",
        "iyz_pay_orphan",
        "TRY",
        "cart_1",
        "conv_1",
        "189.9",
        "189.9",
        "valid-iyz-token-123",
      ],
      "sandbox-secret-test",
    );
    const fetchMock = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            status: "success",
            paymentStatus: "SUCCESS",
            paymentId: "iyz_pay_orphan",
            currency: "TRY",
            basketId: "cart_1",
            conversationId: "conv_1",
            paidPrice: "189.90",
            price: "189.90",
            token: "valid-iyz-token-123",
            signature: sig,
          }),
          { status: 200 },
        ),
    );

    const r1 = await processIyzicoCallback(
      { token: "valid-iyz-token-123" },
      { ...h, fetchImpl: fetchMock as any },
    );
    const r2 = await processIyzicoCallback(
      { token: "valid-iyz-token-123" },
      { ...h, fetchImpl: fetchMock as any },
    );

    expect(r1.status).toBe("failed");
    expect(r2.status).toBe("failed");
    expect(h.getCompleteCount()).toBe(0);
    expect(h.orphanRows).toHaveLength(1);
    expect(h.orphanRows[0].iyzico_payment_id).toBe("iyz_pay_orphan");
    expect(h.orphanRows[0].amount).toBe(189.9);

    // Fake/unpaid token must NOT create orphan_payment
    const hFake = makeHarness({}, { sessionMissing: true });
    const fetchFail = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "failure", errorMessage: "Not found" }), {
        status: 200,
      }),
    );
    await processIyzicoCallback(
      { token: "fake-token-999" },
      { ...hFake, fetchImpl: fetchFail as any },
    );
    expect(hFake.orphanRows).toHaveLength(0);
  });

  it("marks needs_manual_refund and returns 200 when cart completion fails due to unpublished or deleted product", async () => {
    const h = makeHarness();
    const sig = calculateIyzicoHmacSha256(
      ["SUCCESS", "iyz_pay_1", "TRY", "cart_1", "conv_1", "150", "150", "valid-iyz-token-123"],
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
      {
        ...h,
        fetchImpl: fetchMock as any,
        completeOrder: async () => {
          throw new Error('[PRODUCT_UNPUBLISHED] "Koltuk" ürünü şu anda yayında değil.');
        },
      },
    );

    expect(res.httpStatus).toBe(200);
    expect(res.status).toBe("failed");
    expect(h.session.data.needs_manual_refund).toBe(true);
    expect(String(h.session.data.manual_refund_reason)).toContain("PRODUCT_UNPUBLISHED");
  });
});
