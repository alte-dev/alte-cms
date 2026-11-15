import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  customerSessionGuard,
  defaultAdminProductOrder,
  hasValidInternalSecret,
  normalizeDefaultProductOption,
  orderOwnershipGuard,
  requireInternalSecret,
  strictCustomerSessionGuard,
} from "./middleware-guards";

function createJwt(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("Medusa Middleware Guards (Fail-Closed)", () => {
  const SECRET = "a-very-strong-random-internal-secret-at-least-32-chars";
  const JWT_SECRET = "a-very-strong-random-jwt-secret-at-least-32-chars";
  const originalInternal = process.env.INTERNAL_API_SECRET;
  const originalJwt = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = SECRET;
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterEach(() => {
    process.env.INTERNAL_API_SECRET = originalInternal;
    process.env.JWT_SECRET = originalJwt;
  });

  it("hasValidInternalSecret rejects missing, wrong, or unset secret", () => {
    expect(hasValidInternalSecret({ headers: {} })).toBe(false);
    expect(hasValidInternalSecret({ headers: { "x-alte-internal": "wrong" } })).toBe(false);
    expect(hasValidInternalSecret({ headers: { "x-alte-internal": SECRET } })).toBe(true);

    delete process.env.INTERNAL_API_SECRET;
    expect(hasValidInternalSecret({ headers: { "x-alte-internal": SECRET } })).toBe(false);
  });

  it("requireInternalSecret returns 404 when secret is invalid and calls next() when valid", () => {
    const next1 = vi.fn();
    const res1 = createMockRes();
    requireInternalSecret({ headers: {} } as any, res1, next1);
    expect(res1.statusCode).toBe(404);
    expect(next1).not.toHaveBeenCalled();

    const next2 = vi.fn();
    const res2 = createMockRes();
    requireInternalSecret({ headers: { "x-alte-internal": SECRET } } as any, res2, next2);
    expect(next2).toHaveBeenCalledOnce();
  });

  it("customerSessionGuard returns 401 when customer JWT is revoked or missing in customer_session", async () => {
    const token = createJwt(
      { actor_id: "cust_1", actor_type: "customer", exp: Math.floor(Date.now() / 1000) + 3600 },
      JWT_SECRET,
    );

    const fakePgRevoked = () => ({
      where: () => ({
        whereNull: () => ({
          first: async () => ({
            id: "sess_1",
            customer_id: "cust_1",
            revoked_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            last_seen_at: new Date().toISOString(),
          }),
        }),
      }),
    });

    const next = vi.fn();
    const res = createMockRes();
    await customerSessionGuard(
      {
        headers: { authorization: `Bearer ${token}` },
        scope: { resolve: () => fakePgRevoked },
      } as any,
      res,
      next,
    );

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("customerSessionGuard passes through active customer session and non-customer (admin) JWT", async () => {
    const adminToken = createJwt(
      { actor_id: "user_1", actor_type: "user", exp: Math.floor(Date.now() / 1000) + 3600 },
      JWT_SECRET,
    );
    const nextAdmin = vi.fn();
    await customerSessionGuard(
      {
        headers: { authorization: `Bearer ${adminToken}` },
        scope: { resolve: () => vi.fn() },
      } as any,
      createMockRes(),
      nextAdmin,
    );
    expect(nextAdmin).toHaveBeenCalledOnce();

    const custToken = createJwt(
      { actor_id: "cust_1", actor_type: "customer", exp: Math.floor(Date.now() / 1000) + 3600 },
      JWT_SECRET,
    );
    const fakePgActive = () => ({
      where: () => ({
        whereNull: () => ({
          first: async () => ({
            id: "sess_1",
            customer_id: "cust_1",
            revoked_at: null,
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            last_seen_at: new Date().toISOString(),
          }),
        }),
      }),
    });
    const nextCust = vi.fn();
    await customerSessionGuard(
      {
        headers: { authorization: `Bearer ${custToken}` },
        scope: { resolve: () => fakePgActive },
      } as any,
      createMockRes(),
      nextCust,
    );
    expect(nextCust).toHaveBeenCalledOnce();
  });

  it("strictCustomerSessionGuard returns 401 when Bearer token is missing, but allows admin JWT", async () => {
    const nextMissing = vi.fn();
    const resMissing = createMockRes();
    await strictCustomerSessionGuard({ headers: {} } as any, resMissing, nextMissing);
    expect(resMissing.statusCode).toBe(401);
    expect(nextMissing).not.toHaveBeenCalled();

    const adminToken = createJwt(
      { actor_id: "user_1", actor_type: "user", exp: Math.floor(Date.now() / 1000) + 3600 },
      JWT_SECRET,
    );
    const nextAdmin = vi.fn();
    await strictCustomerSessionGuard(
      {
        headers: { authorization: `Bearer ${adminToken}` },
        scope: { resolve: () => vi.fn() },
      } as any,
      createMockRes(),
      nextAdmin,
    );
    expect(nextAdmin).toHaveBeenCalledOnce();
    // Valid internal secret (e.g., server-side /siparis-onay getOrder) -> next()
    const nextInternal = vi.fn();
    await strictCustomerSessionGuard(
      {
        headers: { "x-alte-internal": SECRET },
      } as any,
      createMockRes(),
      nextInternal,
    );
    expect(nextInternal).toHaveBeenCalledOnce();
  });

  it("orderOwnershipGuard denies unauthenticated or non-owner requests with 404, allows owner or internal secret", async () => {
    const custToken = createJwt(
      { actor_id: "cust_B", actor_type: "customer", exp: Math.floor(Date.now() / 1000) + 3600 },
      JWT_SECRET,
    );

    const fakePg = (table: string) => {
      if (table === "customer_session") {
        return {
          where: () => ({
            whereNull: () => ({
              first: async () => ({
                id: "sess_B",
                customer_id: "cust_B",
                revoked_at: null,
                expires_at: new Date(Date.now() + 3600_000).toISOString(),
                last_seen_at: new Date().toISOString(),
              }),
            }),
          }),
        };
      }
      if (table === "order") {
        return {
          where: (cond: Record<string, string>) => ({
            whereNull: () => ({
              first: async () => (cond.customer_id === "cust_A" ? { id: "ord_1" } : null),
            }),
          }),
        };
      }
      return {};
    };

    // Anonymous -> 404
    const resAnon = createMockRes();
    const nextAnon = vi.fn();
    await orderOwnershipGuard(
      { params: { id: "ord_1" }, headers: {}, scope: { resolve: () => fakePg } } as any,
      resAnon,
      nextAnon,
    );
    expect(resAnon.statusCode).toBe(404);

    // Wrong customer B -> 404
    const resB = createMockRes();
    const nextB = vi.fn();
    await orderOwnershipGuard(
      {
        params: { id: "ord_1" },
        headers: { authorization: `Bearer ${custToken}` },
        scope: { resolve: () => fakePg },
      } as any,
      resB,
      nextB,
    );
    expect(resB.statusCode).toBe(404);
    expect(nextB).not.toHaveBeenCalled();

    // Valid internal secret -> next()
    const nextInternal = vi.fn();
    await orderOwnershipGuard(
      {
        params: { id: "ord_1" },
        headers: { "x-alte-internal": SECRET },
        scope: { resolve: () => fakePg },
      } as any,
      createMockRes(),
      nextInternal,
    );
    expect(nextInternal).toHaveBeenCalledOnce();
  });

  it("defaultAdminProductOrder sets order=-created_at when missing and preserves explicit order", () => {
    const reqWithoutOrder: any = {
      query: {},
      queryConfig: { pagination: { skip: 0, take: 20, order: undefined } },
      listConfig: {},
    };
    const next1 = vi.fn();
    defaultAdminProductOrder(reqWithoutOrder, createMockRes(), next1);
    expect(reqWithoutOrder.query.order).toBe("-created_at");
    expect(reqWithoutOrder.queryConfig.pagination.order).toEqual({ created_at: "DESC" });
    expect(reqWithoutOrder.listConfig.order).toEqual({ created_at: "DESC" });
    expect(next1).toHaveBeenCalledOnce();

    const reqWithOrder: any = { query: { order: "title" }, validatedQuery: { order: "title" } };
    const next2 = vi.fn();
    defaultAdminProductOrder(reqWithOrder, createMockRes(), next2);
    expect(reqWithOrder.query.order).toBe("title");
    expect(next2).toHaveBeenCalledOnce();
  });

  it("normalizeDefaultProductOption translates Default option/value to Varsayılan/Standart and leaves custom options untouched", () => {
    const reqDefault: any = {
      body: {
        title: "Test Kolye",
        options: [{ title: "Default option", values: ["Default option value"] }],
        variants: [
          {
            title: "Default variant",
            options: { "Default option": "Default option value" },
          },
        ],
      },
      validatedBody: {
        title: "Test Kolye",
        options: [{ title: "Default option", values: ["Default option value"] }],
        variants: [
          {
            title: "Default option value",
            options: { "Default option": "Default option value" },
          },
        ],
      },
    };
    const next1 = vi.fn();
    normalizeDefaultProductOption(reqDefault, createMockRes(), next1);
    expect(reqDefault.body.options).toEqual([{ title: "Varsayılan", values: ["Standart"] }]);
    expect(reqDefault.body.variants[0]).toEqual({
      title: "Standart",
      options: { Varsayılan: "Standart" },
    });
    expect(reqDefault.validatedBody.options).toEqual([
      { title: "Varsayılan", values: ["Standart"] },
    ]);
    expect(reqDefault.validatedBody.variants[0]).toEqual({
      title: "Standart",
      options: { Varsayılan: "Standart" },
    });
    expect(next1).toHaveBeenCalledOnce();

    const reqCustom: any = {
      body: {
        title: "Özel Yüzük",
        options: [{ title: "Beden", values: ["12", "14"] }],
        variants: [{ title: "12", options: { Beden: "12" } }],
      },
    };
    const next2 = vi.fn();
    normalizeDefaultProductOption(reqCustom, createMockRes(), next2);
    expect(reqCustom.body.options).toEqual([{ title: "Beden", values: ["12", "14"] }]);
    expect(reqCustom.body.variants[0]).toEqual({ title: "12", options: { Beden: "12" } });
    expect(next2).toHaveBeenCalledOnce();
  });
});
