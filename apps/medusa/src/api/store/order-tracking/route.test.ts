import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

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

function createMockReq(overrides: Record<string, unknown> = {}) {
  const emptyOrderQuery = () => ({
    where: () => ({
      first: async () => null,
    }),
  });
  return {
    ip: "192.0.2.99",
    headers: {},
    body: {},
    scope: {
      resolve: (key: string) => {
        if (key === "query") return { graph: vi.fn().mockResolvedValue({ data: [] }) };
        return emptyOrderQuery;
      },
    },
    ...overrides,
  };
}

describe("POST /store/order-tracking security & rate limits", () => {
  it("ignores spoofed X-Forwarded-For and locks per-order across rotated x-alte-client-ip", async () => {
    const orderNum = `ORD-RL-${Date.now()}`;

    // Send 20 failed attempts with 20 different x-alte-client-ip values (and rotating XFF)
    for (let i = 0; i < 20; i++) {
      const req = createMockReq({
        headers: {
          "x-forwarded-for": `192.0.2.${i + 1}`,
          "x-alte-client-ip": `198.51.100.${i + 1}`,
        },
        body: {
          order_id_or_number: orderNum,
          email: `guess${i}@example.test`,
        },
      });
      const res = createMockRes();
      await POST(req as any, res);
      expect(res.statusCode).toBe(404);
    }

    // 21st attempt from a brand new IP for the same order -> 429 (per-order limit)
    const req21 = createMockReq({
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "x-alte-client-ip": "203.0.113.10",
      },
      body: {
        order_id_or_number: orderNum,
        email: "guess21@example.test",
      },
    });
    const res21 = createMockRes();
    await POST(req21 as any, res21);
    expect(res21.statusCode).toBe(429);

    // Different order from a different IP is NOT affected
    const otherReq = createMockReq({
      headers: {
        "x-alte-client-ip": "203.0.113.11",
      },
      body: {
        order_id_or_number: `${orderNum}-OTHER`,
        email: "other@example.test",
      },
    });
    const otherRes = createMockRes();
    await POST(otherReq as any, otherRes);
    expect(otherRes.statusCode).toBe(404);
  });

  it("uses single 'unknown' bucket when x-alte-client-ip is absent even if X-Forwarded-For rotates", async () => {
    const orderBase = `ORD-XFF-${Date.now()}`;
    // 5 failed attempts with rotating XFF and same order -> 6th should be 429 because IP is "unknown"
    for (let i = 0; i < 5; i++) {
      const req = createMockReq({
        headers: {
          "x-forwarded-for": `192.0.2.${i + 50}`,
        },
        body: {
          order_id_or_number: orderBase,
          email: `xff${i}@example.test`,
        },
      });
      const res = createMockRes();
      await POST(req as any, res);
      expect(res.statusCode).toBe(404);
    }

    const req6 = createMockReq({
      headers: {
        "x-forwarded-for": "192.0.2.250",
      },
      body: {
        order_id_or_number: orderBase,
        email: "xff6@example.test",
      },
    });
    const res6 = createMockRes();
    await POST(req6 as any, res6);
    expect(res6.statusCode).toBe(429);
  });
});
