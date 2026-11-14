import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as registerPost } from "./register/route";
import { POST as verifyEmailPost } from "./verify-email/route";

const TEST_ENC_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

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

describe("account register & verify-email regression tests", () => {
  const originalEncKey = process.env.SETTINGS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = TEST_ENC_KEY;
  });

  afterEach(() => {
    process.env.SETTINGS_ENCRYPTION_KEY = originalEncKey;
    vi.restoreAllMocks();
  });

  it("register fails and compensates if customer_account_state / consent insert fails (no silent 202)", async () => {
    const deleteCustomers = vi.fn().mockResolvedValue(undefined);
    const deleteAuthIdentities = vi.fn().mockResolvedValue(undefined);

    const customerQueryChain: any = {
      whereRaw: () => customerQueryChain,
      andWhere: () => customerQueryChain,
      whereNull: () => customerQueryChain,
      first: vi.fn().mockResolvedValue(null),
    };

    const mockPg: any = vi.fn((table: string) => {
      if (table === "customer") return customerQueryChain;
      return {
        insert: vi.fn().mockRejectedValue(new Error("simulated db failure")),
      };
    });
    mockPg.transaction = vi.fn(async (cb: any) => {
      const trx = vi.fn((table: string) => {
        if (table === "customer_account_state") {
          return { insert: vi.fn().mockRejectedValue(new Error("simulated state insert failure")) };
        }
        return { insert: vi.fn().mockResolvedValue(undefined) };
      });
      return cb(trx);
    });

    const req: any = {
      headers: { "x-alte-client-ip": "198.51.100.10" },
      url: "/store/account/register",
      query: {},
      protocol: "http",
      body: {
        email: `atomic-fail-${Date.now()}@example.test`,
        password: "StrongPassword123!",
        first_name: "Ali",
        last_name: "Yilmaz",
        kvkk_notice: true,
        kvkk_version: "v1",
        marketing_consent: false,
        marketing_version: "v1",
      },
      scope: {
        resolve: (key: string) => {
          if (key === "__pg_connection__" || key === "pgConnection") return mockPg;
          if (key === "event_bus") return { emit: vi.fn() };
          if (key === "auth") {
            return {
              register: vi.fn().mockResolvedValue({
                success: true,
                authIdentity: { id: "auth_1", app_metadata: {} },
              }),
              updateAuthIdentities: vi.fn().mockResolvedValue(undefined),
              deleteAuthIdentities,
            };
          }
          if (key === "customer") {
            return {
              createCustomers: vi.fn().mockResolvedValue({ id: "cus_1" }),
              deleteCustomers,
            };
          }
          return null;
        },
      },
    };

    const res = makeMockRes();
    await expect(registerPost(req, res)).rejects.toThrow(/simulated state insert failure/);
    expect(deleteCustomers).toHaveBeenCalledWith(["cus_1"]);
    expect(deleteAuthIdentities).toHaveBeenCalledWith(["auth_1"]);
  });

  it("verify-email upserts missing customer_account_state row and marks verified", async () => {
    const rawCalls: Array<{ sql: string; bindings: any[] }> = [];
    const mockPg: any = vi.fn((table: string) => {
      if (table === "customer_email_verification") {
        const chain: any = {
          where: () => chain,
          whereNull: () => chain,
          andWhere: () => chain,
          update: () => ({
            returning: vi.fn().mockResolvedValue([{ customer_id: "cus_missing_state" }]),
          }),
        };
        return chain;
      }
      if (table === "customer") {
        const chain: any = {
          where: () => chain,
          whereNull: () => chain,
          select: () => chain,
          first: vi.fn().mockResolvedValue(null),
        };
        return chain;
      }
      return {};
    });
    mockPg.raw = vi.fn(async (sql: string, bindings: any[]) => {
      rawCalls.push({ sql, bindings });
      return {
        rows: [{ customer_id: "cus_missing_state", email_verified_at: new Date() }],
      };
    });

    const req: any = {
      headers: { "x-alte-client-ip": "198.51.100.11" },
      body: { token: "valid-opaque-token-123456" },
      scope: {
        resolve: (key: string) => {
          if (key === "__pg_connection__" || key === "pgConnection") return mockPg;
          return null;
        },
      },
    };

    const res = makeMockRes();
    await verifyEmailPost(req, res);

    expect(res.statusCode).toBe(200);
    expect(rawCalls.length).toBe(1);
    expect(rawCalls[0].sql).toMatch(/ON CONFLICT \(customer_id\) DO UPDATE/i);
  });

  it("verify-email returns HTTP 500 and logs error when zero rows are affected (never silent 200)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockPg: any = vi.fn((table: string) => {
      if (table === "customer_email_verification") {
        const chain: any = {
          where: () => chain,
          whereNull: () => chain,
          andWhere: () => chain,
          update: () => ({
            returning: vi.fn().mockResolvedValue([{ customer_id: "cus_zero_rows" }]),
          }),
        };
        return chain;
      }
      return {};
    });
    mockPg.raw = vi.fn(async () => ({ rows: [] }));

    const req: any = {
      headers: { "x-alte-client-ip": "198.51.100.12" },
      body: { token: "valid-opaque-token-654321" },
      scope: {
        resolve: (key: string) => {
          if (key === "__pg_connection__" || key === "pgConnection") return mockPg;
          return null;
        },
      },
    };

    const res = makeMockRes();
    await verifyEmailPost(req, res);

    expect(res.statusCode).toBe(500);
    expect(errSpy).toHaveBeenCalled();
  });
});
