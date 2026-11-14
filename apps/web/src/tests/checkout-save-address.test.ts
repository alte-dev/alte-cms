import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isMatchingCustomerAddress,
  saveCustomerAddressFromCheckout,
  type CustomerAddress,
} from "../lib/medusa/account";

describe("Checkout Customer Address Auto-Save", () => {
  const sampleInput = {
    firstName: "Ümit",
    lastName: "Demir",
    phone: "+905313259065",
    city: "Adana",
    district: "Seyhan",
    addressLine1: "Atatürk Caddesi No: 12 Daire: 4",
    addressLine2: "Kat 2",
    postalCode: "01120",
  };

  const existingAddress: CustomerAddress = {
    id: "addr_1",
    address_name: "Adana - Seyhan",
    first_name: "Ümit",
    last_name: "Demir",
    phone: "+905313259065",
    address_1: "Atatürk Caddesi No: 12 Daire: 4",
    address_2: "Kat 2",
    city: "Adana",
    province: "Seyhan",
    postal_code: "01120",
    country_code: "tr",
    is_default_shipping: true,
    is_default_billing: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects matching customer address ignoring case and surrounding whitespace", () => {
    expect(
      isMatchingCustomerAddress(existingAddress, {
        ...sampleInput,
        firstName: "  ümit ",
        district: "seyhan ",
      }),
    ).toBe(true);

    expect(
      isMatchingCustomerAddress(existingAddress, {
        ...sampleInput,
        addressLine1: "Farklı Sokak No: 99",
      }),
    ).toBe(false);
  });

  it("saves delivery address as default shipping when customer has no saved addresses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ addresses: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ customer: { addresses: [existingAddress] } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveCustomerAddressFromCheckout("cust_token_123", sampleInput);

    expect(saved).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toContain("/store/customers/me/addresses");
    expect(postCall[1].method).toBe("POST");
    const body = JSON.parse(postCall[1].body as string);
    expect(body).toMatchObject({
      address_name: "Adana - Seyhan",
      first_name: "Ümit",
      last_name: "Demir",
      phone: "+905313259065",
      address_1: "Atatürk Caddesi No: 12 Daire: 4",
      address_2: "Kat 2",
      city: "Adana",
      province: "Seyhan",
      postal_code: "01120",
      country_code: "tr",
      is_default_shipping: true,
      is_default_billing: true,
    });
  });

  it("skips creating duplicate address when matching address already exists", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ addresses: [existingAddress] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveCustomerAddressFromCheckout("cust_token_123", sampleInput);

    expect(saved).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("saves new address without overriding existing default shipping address", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ addresses: [existingAddress] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ customer: { addresses: [existingAddress] } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveCustomerAddressFromCheckout("cust_token_123", {
      ...sampleInput,
      city: "İstanbul",
      district: "Kadıköy",
      addressLine1: "Moda Caddesi No: 15",
    });

    expect(saved).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.is_default_shipping).toBe(false);
    expect(body.is_default_billing).toBe(false);
    expect(body.city).toBe("İstanbul");
    expect(body.province).toBe("Kadıköy");
  });

  it("logs warning and returns false without throwing when address save fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Medusa unreachable"));
    vi.stubGlobal("fetch", fetchMock);

    const saved = await saveCustomerAddressFromCheckout("cust_token_123", sampleInput);

    expect(saved).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});
