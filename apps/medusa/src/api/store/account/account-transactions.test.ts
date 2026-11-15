import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { POST as deletePost } from "./delete/route";
import { POST as resetConfirmPost } from "./password-reset/confirm/route";
import { POST as passwordPost } from "./password/route";

const TEST_JWT_SECRET = "test-jwt-secret-at-least-32-characters-long-12345";

function createJwt(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function makeMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("SEC-030: Multi-step account writes use transactions & safe ordering", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    vi.restoreAllMocks();
  });

  it("account/delete runs anonymization, identity deletion, and session revocation inside pgConnection.transaction", async () => {
    const customerToken = createJwt(
      { actor_id: "cust_1", actor_type: "customer", exp: Math.floor(Date.now() / 1000) + 3600 },
      TEST_JWT_SECRET,
    );

    const directMutationCalls: string[] = [];
    const trxMutationCalls: string[] = [];

    const makeChain = (table: string, isTrx: boolean) => {
      const chain: any = {
        where: () => chain,
        andWhere: () => chain,
        whereNot: () => chain,
        whereRaw: () => chain,
        whereNull: () => chain,
        select: () => chain,
        first: vi
          .fn()
          .mockResolvedValue(
            table === "customer" ? { id: "cust_1", email: "user@example.test" } : null,
          ),
        then: (resolve: any) => resolve([]),
        update: vi.fn(async () => {
          (isTrx ? trxMutationCalls : directMutationCalls).push(`${table}.update`);
          if (isTrx && table === "customer_session") {
            throw new Error("simulated session revoke failure");
          }
          return 1;
        }),
        del: vi.fn(async () => {
          (isTrx ? trxMutationCalls : directMutationCalls).push(`${table}.del`);
          return 1;
        }),
      };
      return chain;
    };

    const mockPg: any = vi.fn((table: string) => makeChain(table, false));
    mockPg.transaction = vi.fn(async (cb: any) => {
      const trx = vi.fn((table: string) => makeChain(table, true));
      return cb(trx);
    });

    const req: any = {
      headers: { authorization: `Bearer ${customerToken}` },
      body: { password: "ValidPassword123!", confirmation: "SİL" },
      url: "/store/account/delete",
      query: {},
      protocol: "http",
      scope: {
        resolve: (key: string) => {
          if (key === ContainerRegistrationKeys.PG_CONNECTION || key === "__pg_connection__") {
            return mockPg;
          }
          if (key === Modules.AUTH) {
            return {
              authenticate: vi.fn().mockResolvedValue({
                success: true,
                authIdentity: { id: "auth_1" },
              }),
            };
          }
          return null;
        },
      },
    };

    const res = makeMockRes();
    await expect(deletePost(req, res)).rejects.toThrow("simulated session revoke failure");

    expect(mockPg.transaction).toHaveBeenCalledOnce();
    expect(directMutationCalls).toEqual([]);
    expect(trxMutationCalls).toContain("customer.update");
    expect(trxMutationCalls).toContain("customer_session.update");
  });

  it("password-reset/confirm does NOT consume reset token if authService.updateProvider fails", async () => {
    const resetJwt = createJwt(
      {
        actor_type: "customer",
        purpose: "reset",
        entity_id: "user@example.test",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      TEST_JWT_SECRET,
    );

    const tokenUpdateSpy = vi.fn().mockResolvedValue([{ customer_id: "cust_1" }]);

    const makeChain = (table: string) => {
      const chain: any = {
        where: () => chain,
        whereNull: () => chain,
        andWhere: () => chain,
        select: () => chain,
        first: vi
          .fn()
          .mockResolvedValue(
            table === "customer_password_reset"
              ? { customer_id: "cust_1" }
              : table === "customer"
                ? { id: "cust_1", email: "user@example.test" }
                : table === "provider_identity"
                  ? { id: "prov_1" }
                  : null,
          ),
        update: (data: any) => {
          if (table === "customer_password_reset") {
            tokenUpdateSpy(data);
          }
          return {
            returning: async () => [{ customer_id: "cust_1" }],
          };
        },
        del: vi.fn().mockResolvedValue(1),
      };
      return chain;
    };

    const mockPg: any = vi.fn((table: string) => makeChain(table));
    mockPg.transaction = vi.fn(async (cb: any) => {
      const trx = vi.fn((table: string) => makeChain(table));
      return cb(trx);
    });

    const req: any = {
      headers: { "x-alte-client-ip": "127.0.0.1" },
      body: { token: resetJwt, password: "NewStrongPassword123!" },
      url: "/store/account/password-reset/confirm",
      query: {},
      protocol: "http",
      scope: {
        resolve: (key: string) => {
          if (key === ContainerRegistrationKeys.CONFIG_MODULE) {
            return { projectConfig: { http: { jwtSecret: TEST_JWT_SECRET } } };
          }
          if (key === ContainerRegistrationKeys.PG_CONNECTION || key === "__pg_connection__") {
            return mockPg;
          }
          if (key === Modules.AUTH) {
            return {
              updateProvider: vi.fn().mockResolvedValue({ success: false }),
            };
          }
          return null;
        },
      },
    };

    const res = makeMockRes();
    await resetConfirmPost(req, res);

    expect(res.statusCode).toBe(400);
    expect(tokenUpdateSpy).not.toHaveBeenCalled();
    expect(mockPg.transaction).not.toHaveBeenCalled();
  });

  it("password-reset/confirm runs token consumption and session revocation in a single transaction after password update succeeds", async () => {
    const resetJwt = createJwt(
      {
        actor_type: "customer",
        purpose: "reset",
        entity_id: "user@example.test",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      TEST_JWT_SECRET,
    );

    const directMutationCalls: string[] = [];
    const trxMutationCalls: string[] = [];

    const makeChain = (table: string, isTrx: boolean) => {
      const chain: any = {
        where: () => chain,
        whereNull: () => chain,
        andWhere: () => chain,
        select: () => chain,
        first: vi
          .fn()
          .mockResolvedValue(
            table === "customer_password_reset"
              ? { customer_id: "cust_1" }
              : table === "customer"
                ? { id: "cust_1", email: "user@example.test" }
                : table === "provider_identity"
                  ? { id: "prov_1" }
                  : null,
          ),
        update: vi.fn(() => {
          (isTrx ? trxMutationCalls : directMutationCalls).push(`${table}.update`);
          if (isTrx && table === "customer_session") {
            return Promise.reject(new Error("simulated session revoke failure"));
          }
          return {
            returning: async () => [{ customer_id: "cust_1" }],
            then: (resolve: any) => resolve(1),
          };
        }),
        del: vi.fn(async () => {
          (isTrx ? trxMutationCalls : directMutationCalls).push(`${table}.del`);
          return 1;
        }),
      };
      return chain;
    };

    const mockPg: any = vi.fn((table: string) => makeChain(table, false));
    mockPg.transaction = vi.fn(async (cb: any) => {
      const trx = vi.fn((table: string) => makeChain(table, true));
      return cb(trx);
    });

    const req: any = {
      headers: { "x-alte-client-ip": "127.0.0.1" },
      body: { token: resetJwt, password: "NewStrongPassword123!" },
      url: "/store/account/password-reset/confirm",
      query: {},
      protocol: "http",
      scope: {
        resolve: (key: string) => {
          if (key === ContainerRegistrationKeys.CONFIG_MODULE) {
            return { projectConfig: { http: { jwtSecret: TEST_JWT_SECRET } } };
          }
          if (key === ContainerRegistrationKeys.PG_CONNECTION || key === "__pg_connection__") {
            return mockPg;
          }
          if (key === Modules.AUTH) {
            return {
              updateProvider: vi.fn().mockResolvedValue({ success: true }),
            };
          }
          return null;
        },
      },
    };

    const res = makeMockRes();
    await expect(resetConfirmPost(req, res)).rejects.toThrow("simulated session revoke failure");

    expect(mockPg.transaction).toHaveBeenCalledOnce();
    expect(directMutationCalls).toEqual([]);
    expect(trxMutationCalls).toContain("customer_password_reset.update");
    expect(trxMutationCalls).toContain("customer_session.update");
  });

  it("account/password revokes old sessions and inserts new session inside pgConnection.transaction", async () => {
    const customerToken = createJwt(
      { actor_id: "cust_1", actor_type: "customer", exp: Math.floor(Date.now() / 1000) + 3600 },
      TEST_JWT_SECRET,
    );

    const directMutationCalls: string[] = [];
    const trxMutationCalls: string[] = [];

    const makeChain = (table: string, isTrx: boolean) => {
      const chain: any = {
        where: () => chain,
        whereNull: () => chain,
        select: () => chain,
        first: vi
          .fn()
          .mockResolvedValue(
            table === "customer" ? { id: "cust_1", email: "user@example.test" } : null,
          ),
        update: vi.fn(async () => {
          (isTrx ? trxMutationCalls : directMutationCalls).push(`${table}.update`);
          return 1;
        }),
        insert: vi.fn(async () => {
          (isTrx ? trxMutationCalls : directMutationCalls).push(`${table}.insert`);
          if (isTrx && table === "customer_session") {
            throw new Error("simulated session insert failure");
          }
          return [1];
        }),
      };
      return chain;
    };

    const mockPg: any = vi.fn((table: string) => makeChain(table, false));
    mockPg.transaction = vi.fn(async (cb: any) => {
      const trx = vi.fn((table: string) => makeChain(table, true));
      return cb(trx);
    });

    const req: any = {
      headers: { authorization: `Bearer ${customerToken}` },
      body: {
        current_password: "OldPassword123!",
        new_password: "NewStrongPassword123!",
      },
      url: "/store/account/password",
      query: {},
      protocol: "http",
      scope: {
        resolve: (key: string) => {
          if (key === ContainerRegistrationKeys.CONFIG_MODULE) {
            return {
              projectConfig: {
                http: { jwtSecret: TEST_JWT_SECRET, jwtOptions: {} },
              },
            };
          }
          if (key === ContainerRegistrationKeys.PG_CONNECTION || key === "__pg_connection__") {
            return mockPg;
          }
          if (key === Modules.AUTH) {
            return {
              authenticate: vi.fn().mockResolvedValue({
                success: true,
                authIdentity: { id: "auth_1" },
              }),
              updateProvider: vi.fn().mockResolvedValue({ success: true }),
            };
          }
          return null;
        },
      },
    };

    const res = makeMockRes();
    await expect(passwordPost(req, res)).rejects.toThrow("simulated session insert failure");

    expect(mockPg.transaction).toHaveBeenCalledOnce();
    expect(directMutationCalls).toEqual([]);
    expect(trxMutationCalls).toContain("customer_session.update");
    expect(trxMutationCalls).toContain("customer_session.insert");
  });
});
