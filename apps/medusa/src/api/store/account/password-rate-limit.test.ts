import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { POST as deletePost } from "./delete/route";
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

describe("SEC-029: Password verification rate limit & tiered session revocation", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    vi.restoreAllMocks();
  });

  function buildReq(customerId: string, body: any, authSuccess: boolean, revokeSpy: any) {
    const token = createJwt(
      { actor_id: customerId, actor_type: "customer", exp: Math.floor(Date.now() / 1000) + 3600 },
      TEST_JWT_SECRET,
    );

    const makeChain = (table: string) => {
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
            table === "customer" ? { id: customerId, email: `${customerId}@example.test` } : null,
          ),
        update: vi.fn(async () => {
          if (table === "customer_session") {
            revokeSpy();
          }
          return 1;
        }),
        insert: vi.fn().mockResolvedValue([1]),
        del: vi.fn().mockResolvedValue(1),
      };
      return chain;
    };

    const mockPg: any = vi.fn((table: string) => makeChain(table));
    mockPg.transaction = vi.fn(async (cb: any) => cb(mockPg));

    return {
      headers: { authorization: `Bearer ${token}` },
      body,
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
              authenticate: vi
                .fn()
                .mockResolvedValue(
                  authSuccess
                    ? { success: true, authIdentity: { id: "auth_1" } }
                    : { success: false },
                ),
              updateProvider: vi.fn().mockResolvedValue({ success: true }),
            };
          }
          return null;
        },
      },
    } as any;
  }

  it("returns 429 on 6th attempt after 5 wrong current-password attempts on /store/account/password without revoking session yet", async () => {
    const customerId = `cust_pw_429_${Date.now()}`;
    const revokeSpy = vi.fn();

    for (let i = 0; i < 5; i++) {
      const res = makeMockRes();
      await passwordPost(
        buildReq(
          customerId,
          { current_password: "WrongPassword1!", new_password: "NewStrongPassword123!" },
          false,
          revokeSpy,
        ),
        res,
      );
      expect(res.statusCode).toBe(401);
    }

    // 5 failures should NOT have revoked the customer's session yet
    expect(revokeSpy).not.toHaveBeenCalled();

    // 6th attempt should be rate-limited with 429
    const blockedRes = makeMockRes();
    await passwordPost(
      buildReq(
        customerId,
        { current_password: "WrongPassword1!", new_password: "NewStrongPassword123!" },
        false,
        revokeSpy,
      ),
      blockedRes,
    );
    expect(blockedRes.statusCode).toBe(429);
  });

  it("revokes customer sessions on repeated wrong password attempts on /store/account/delete (tier 2 >= 10)", async () => {
    const customerId = `cust_del_revoke_${Date.now()}`;
    const revokeSpy = vi.fn();

    for (let i = 0; i < 10; i++) {
      const res = makeMockRes();
      await deletePost(
        buildReq(
          customerId,
          { password: "WrongPassword1!", confirmation: "SİL" },
          false,
          revokeSpy,
        ),
        res,
      );
      expect([401, 429]).toContain(res.statusCode);
    }

    expect(revokeSpy).toHaveBeenCalled();
  });

  it("accepts valid current password when under limit", async () => {
    const customerId = `cust_pw_ok_${Date.now()}`;
    const revokeSpy = vi.fn();

    const res = makeMockRes();
    await passwordPost(
      buildReq(
        customerId,
        { current_password: "ValidPassword123!", new_password: "NewStrongPassword123!" },
        true,
        revokeSpy,
      ),
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body?.ok).toBe(true);
  });
});
