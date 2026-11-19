import { describe, expect, it, vi } from "vitest";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { GET, POST } from "./route";

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

describe("Store Cart validate-availability route", () => {
  it("rejects malformed cart IDs with 400 on GET and POST without querying DB", async () => {
    const resolve = vi.fn();
    const badIds = ["", "../admin", "cart_1", "not_a_cart", "cart_abc/../../orders"];

    for (const id of badIds) {
      const getRes = createMockRes();
      await GET({ params: { id }, scope: { resolve } } as any, getRes);
      expect(getRes.statusCode).toBe(400);
      expect(getRes.body).toMatchObject({ valid: false, code: "INVALID_CART_ID" });

      const postRes = createMockRes();
      await POST({ params: { id }, scope: { resolve } } as any, postRes);
      expect(postRes.statusCode).toBe(400);
      expect(postRes.body).toMatchObject({ valid: false, code: "INVALID_CART_ID" });
    }

    expect(resolve).not.toHaveBeenCalled();
  });

  it("accepts a valid Medusa cart ID and returns 404 when cart does not exist", async () => {
    const graph = vi.fn().mockResolvedValue({ data: [] });
    const req: any = {
      params: { id: "cart_01JABCDEF1234567890" },
      scope: {
        resolve: vi.fn((key: string) =>
          key === ContainerRegistrationKeys.QUERY ? { graph } : undefined,
        ),
      },
    };
    const res = createMockRes();

    await POST(req, res);
    expect(graph).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ valid: false, code: "CART_NOT_FOUND" });
  });
});
