import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { initiateIyzicoPayment } from "../lib/medusa/cart";

describe("initiateIyzicoPayment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards buyer email, ip, addresses, and items in payment session data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ payment_collection: { id: "pay_col_1" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          payment_collection: {
            id: "pay_col_1",
            payment_sessions: [
              {
                id: "payses_1",
                provider_id: "pp_iyzico_iyzico",
                data: {
                  token: "iyz_tok_1",
                  payment_page_url: "https://sandbox-cpp.iyzipay.com?token=iyz_tok_1&lang=tr",
                  display_mode: "redirect",
                },
              },
            ],
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await initiateIyzicoPayment("cart_123", {
      email: "misafir@example.com",
      ip: "203.0.113.10",
      billing_address: {
        first_name: "Deniz",
        last_name: "Kaya",
        phone: "+905551112233",
        address_1: "Ornek Cad. 1",
        city: "Ankara",
        postal_code: "06100",
      },
      shipping_address: {
        first_name: "Deniz",
        last_name: "Kaya",
        address_1: "Ornek Cad. 1",
        city: "Ankara",
        postal_code: "06100",
      },
      items: [{ id: "li_1", title: "Ürün 1", unit_price: 150, quantity: 2 }],
    });

    expect(result.token).toBe("iyz_tok_1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sessionCall = fetchMock.mock.calls[1];
    expect(sessionCall[0]).toContain("/store/payment-collections/pay_col_1/payment-sessions");
    const sentBody = JSON.parse(sessionCall[1].body as string);
    expect(sentBody.provider_id).toBe("pp_iyzico_iyzico");
    expect(sentBody.data).toMatchObject({
      cart_id: "cart_123",
      email: "misafir@example.com",
      ip: "203.0.113.10",
      billing_address: {
        first_name: "Deniz",
        last_name: "Kaya",
        city: "Ankara",
      },
      shipping_address: {
        first_name: "Deniz",
        last_name: "Kaya",
        city: "Ankara",
      },
      items: [{ id: "li_1", title: "Ürün 1", unit_price: 150, quantity: 2 }],
    });
  });
});
