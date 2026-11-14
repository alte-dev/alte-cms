import { describe, expect, it, vi } from "vitest";
import {
  decryptLegacyHash,
  encryptLegacyHash,
  generateOpaqueToken,
  hashEmailLookup,
  hashToken,
  linkGuestOrdersForVerifiedCustomer,
  linkOrdersToCustomer,
} from "./helpers";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("customer-account crypto & token helpers", () => {
  it("generates 32-byte URL-safe opaque tokens and deterministic SHA-256 hashes", () => {
    const t1 = generateOpaqueToken();
    const t2 = generateOpaqueToken();

    expect(t1.raw).not.toBe(t2.raw);
    expect(t1.raw.length).toBeGreaterThanOrEqual(40);
    expect(t1.hash).toBe(hashToken(t1.raw));
    expect(t1.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(t1.hash).not.toBe(t1.raw);
  });

  it("computes normalized HMAC-SHA256 email_lookup without leaking plaintext", () => {
    const h1 = hashEmailLookup("  Ali.Yilmaz@Example.Test ", TEST_KEY);
    const h2 = hashEmailLookup("ali.yilmaz@example.test", TEST_KEY);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).not.toContain("ali");
  });

  it("encrypts and decrypts legacy password hashes with AES-256-GCM", () => {
    const fakeHash = "$fake$hash$value";
    const enc = encryptLegacyHash(fakeHash, TEST_KEY);
    expect(enc).not.toContain(fakeHash);
    expect(decryptLegacyHash(enc, TEST_KEY)).toBe(fakeHash);
  });
});

describe("linkGuestOrdersForVerifiedCustomer", () => {
  it("fails closed when email_verified_at is null (does not link guest orders)", async () => {
    const updateMock = vi.fn();
    const fakePg = Object.assign((table: string) => {
      if (table === "customer_account_state") {
        return {
          where: () => ({
            first: async () => ({ customer_id: "cust_1", email_verified_at: null }),
          }),
        };
      }
      return { update: updateMock };
    }, {});

    const res = await linkGuestOrdersForVerifiedCustomer(fakePg, "cust_1", "user@example.test");
    expect(res.linkedCount).toBe(0);
    expect(res.skippedUnverified).toBe(true);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("links only guest-customer orders matching email when account is verified", async () => {
    const updatedIds: string[] = [];
    const fakePg = (table: string) => {
      if (table === "customer_account_state") {
        return {
          where: () => ({
            first: async () => ({
              customer_id: "cust_verified",
              email_verified_at: new Date().toISOString(),
            }),
          }),
        };
      }
      if (table === "order") {
        return {
          join: () => ({
            whereRaw: () => ({
              andWhere: () => ({
                whereNull: () => ({
                  select: async () => [{ id: "order_guest_1" }, { id: "order_guest_2" }],
                }),
              }),
            }),
          }),
          whereIn: (_col: string, ids: string[]) => ({
            update: async () => {
              updatedIds.push(...ids);
              return ids.length;
            },
          }),
        };
      }
      return {};
    };

    const res = await linkGuestOrdersForVerifiedCustomer(
      fakePg,
      "cust_verified",
      "User@Example.Test",
    );
    expect(res.skippedUnverified).toBe(false);
    expect(res.linkedCount).toBe(2);
    expect(updatedIds).toEqual(["order_guest_1", "order_guest_2"]);
  });

  it("exposes linkOrdersToCustomer hook for Faz 10", async () => {
    const updated: { ids: string[]; customerId: string }[] = [];
    const fakePg = () => ({
      whereIn: (_col: string, ids: string[]) => ({
        update: async (payload: { customer_id: string }) => {
          updated.push({ ids, customerId: payload.customer_id });
          return ids.length;
        },
      }),
    });

    const count = await linkOrdersToCustomer(fakePg, "cust_wc_1", ["ord_1", "ord_2"]);
    expect(count).toBe(2);
    expect(updated).toEqual([{ ids: ["ord_1", "ord_2"], customerId: "cust_wc_1" }]);
  });
});
