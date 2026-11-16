import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

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

describe("GET /store/checkout-status security & error handling", () => {
  it("returns 400 when cart_id is missing or invalid", async () => {
    const res1 = createMockRes();
    await GET({ query: {} } as any, res1);
    expect(res1.statusCode).toBe(400);

    const res2 = createMockRes();
    await GET({ query: { cart_id: "invalid cart id with spaces!" } } as any, res2);
    expect(res2.statusCode).toBe(400);
  });

  it("returns 404 when cart is not found", async () => {
    const req: any = {
      query: { cart_id: "cart_01MISSING" },
      scope: {
        resolve: () => ({
          retrieveCart: vi
            .fn()
            .mockRejectedValue(new Error("Cart with id cart_01MISSING was not found")),
        }),
      },
    };
    const res = createMockRes();
    await GET(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("returns static Turkish 500 error without leaking raw err.message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const req: any = {
      query: { cart_id: "cart_01ABC" },
      scope: {
        resolve: () => ({
          retrieveCart: vi
            .fn()
            .mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:5432 secret_db")),
        }),
      },
    };
    const res = createMockRes();
    await GET(req, res);
    expect(res.statusCode).toBe(500);
    expect(String(res.body?.error || "")).not.toContain("ECONNREFUSED");
    expect(String(res.body?.error || "")).not.toContain("secret_db");
    vi.restoreAllMocks();
  });

  it("never calls unfiltered listOrders({}) or unfiltered query.graph on completed cart", async () => {
    const listOrders = vi.fn().mockResolvedValue([]);
    const graph = vi.fn().mockResolvedValue({ data: [] });
    const req: any = {
      query: { cart_id: "cart_01DONE" },
      scope: {
        resolve: (key: string) => {
          if (key === "cart") {
            return {
              retrieveCart: vi.fn().mockResolvedValue({
                id: "cart_01DONE",
                completed_at: "2026-11-16T00:00:00Z",
                metadata: {},
              }),
            };
          }
          if (key === "query") return { graph };
          if (key === "order") return { listOrders };
          return null;
        },
      },
    };
    const res = createMockRes();
    await GET(req, res);
    expect(res.statusCode).toBe(200);
    expect(listOrders).not.toHaveBeenCalled();
    if (graph.mock.calls.length > 0) {
      expect(graph.mock.calls[0][0].filters).toBeDefined();
    }
  });
});
