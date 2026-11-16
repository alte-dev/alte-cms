import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET } from "../app/api/search/suggestions/route";

vi.mock("../lib/medusa/products", () => ({
  searchProducts: vi.fn().mockResolvedValue({ products: [] }),
}));

describe("GET /api/search/suggestions rate limit", () => {
  it("allows 60 requests and returns 429 on 61st request from the same IP", async () => {
    for (let i = 0; i < 60; i++) {
      const req = new NextRequest("http://localhost:3100/api/search/suggestions?q=test");
      const res = await GET(req);
      expect(res.status).toBe(200);
    }

    const req61 = new NextRequest("http://localhost:3100/api/search/suggestions?q=test");
    const res61 = await GET(req61);
    expect(res61.status).toBe(429);
    expect(res61.headers.get("Retry-After")).toBeTruthy();
  });
});
