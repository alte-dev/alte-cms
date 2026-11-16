import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaymentSettingsRegistry } from "../../../../modules/payment-settings/service";
import { POST } from "./route";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("POST /hooks/payment/pp_paytr_paytr fail-closed amount check", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks session needs_manual_review and returns OK without completing cart when expected_amount_kurus is missing or 0", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const merchantKey = "test-merchant-key-123";
    const merchantSalt = "test-merchant-salt-456";
    vi.spyOn(PaymentSettingsRegistry, "get").mockReturnValue({
      paytr_merchant_id: "123456",
      paytr_merchant_key: merchantKey,
      paytr_merchant_salt: merchantSalt,
      paytr_mode: "sandbox",
    } as any);

    const merchantOid = "OIDMISSINGAMT1";
    const totalAmount = "10000";
    const hash = crypto
      .createHmac("sha256", merchantKey)
      .update(`${merchantOid}${merchantSalt}success${totalAmount}`)
      .digest("base64");

    const updatePaymentSession = vi.fn().mockResolvedValue({});
    const authorizePaymentSession = vi.fn().mockResolvedValue({});
    const retrieveCart = vi.fn();

    const fakePg = () => ({
      whereRaw: () => ({
        whereNull: () => ({
          select: async () => [
            {
              id: "payses_1",
              amount: 100,
              currency_code: "try",
              status: "pending",
              data: {
                merchant_oid: merchantOid,
                cart_id: "cart_missing_amt",
                // expected_amount_kurus intentionally missing!
              },
            },
          ],
        }),
      }),
    });

    const req: any = {
      body: {
        merchant_oid: merchantOid,
        status: "success",
        total_amount: totalAmount,
        hash,
        test_mode: "1",
      },
      scope: {
        hasRegistration: () => false,
        resolve: (key: string) => {
          if (key === "payment") {
            return { updatePaymentSession, authorizePaymentSession };
          }
          if (key === "cart") {
            return { retrieveCart };
          }
          return fakePg;
        },
      },
    };

    const res = createMockRes();
    await POST(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("OK");
    expect(authorizePaymentSession).not.toHaveBeenCalled();
    expect(updatePaymentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "payses_1",
        data: expect.objectContaining({
          status: "needs_manual_review",
          needs_manual_review: true,
        }),
      }),
    );
  });
});
