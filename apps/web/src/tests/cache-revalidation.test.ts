import { describe, it, expect, vi, beforeEach } from "vitest";
import { CACHE_TAGS, revalidateContentTag } from "../lib/cache-tags";
import { POST } from "../app/api/revalidate/route";
import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

describe("Cache Strategy & Revalidation (revalidateTag)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("must define standard cache tags for products, categories, blog, and pages", () => {
    expect(CACHE_TAGS.products).toBe("products");
    expect(CACHE_TAGS.product("ipek-elbise")).toBe("product-ipek-elbise");
    expect(CACHE_TAGS.categories).toBe("categories");
    expect(CACHE_TAGS.category("giyim")).toBe("category-giyim");
    expect(CACHE_TAGS.blog).toBe("blog");
    expect(CACHE_TAGS.post("stil-rehberi")).toBe("post-stil-rehberi");
    expect(CACHE_TAGS.pages).toBe("pages");
    expect(CACHE_TAGS.page("hakkimizda")).toBe("page-hakkimizda");
  });

  it("calls revalidateTag and throws when next/cache fails", () => {
    revalidateContentTag("test-tag");
    expect(revalidateTag).toHaveBeenCalledWith("test-tag");

    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error("Store error");
    });
    expect(() => revalidateContentTag("error-tag")).toThrow("Store error");
  });

  it("POST /api/revalidate rejects requests without valid secret header", async () => {
    process.env.PAYLOAD_SECRET = "test-secret-value-123456";

    const req = new NextRequest("http://localhost:3100/api/revalidate", {
      method: "POST",
      body: JSON.stringify({ tag: "products" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("POST /api/revalidate rejects secret in query parameters (must only accept header)", async () => {
    process.env.PAYLOAD_SECRET = "test-secret-value-123456";

    // Secret in query parameter should be ignored and rejected with 401
    const req = new NextRequest(
      "http://localhost:3100/api/revalidate?secret=test-secret-value-123456",
      {
        method: "POST",
        body: JSON.stringify({ tag: "products" }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("POST /api/revalidate rejects missing tag", async () => {
    process.env.PAYLOAD_SECRET = "test-secret-value-123456";

    const req = new NextRequest("http://localhost:3100/api/revalidate", {
      method: "POST",
      headers: {
        "x-revalidate-secret": "test-secret-value-123456",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("POST /api/revalidate accepts valid secret and revalidates tag", async () => {
    process.env.PAYLOAD_SECRET = "test-secret-value-123456";

    const req = new NextRequest("http://localhost:3100/api/revalidate", {
      method: "POST",
      headers: {
        "x-revalidate-secret": "test-secret-value-123456",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tag: "pages" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.revalidated).toBe(true);
    expect(data.tag).toBe("pages");
    expect(revalidateTag).toHaveBeenCalledWith("pages");
  });

  it("POST /api/revalidate returns 500 without leaking error.message when revalidateTag throws", async () => {
    process.env.PAYLOAD_SECRET = "test-secret-value-123456";
    vi.mocked(revalidateTag).mockImplementationOnce(() => {
      throw new Error("Internal secret database error details");
    });

    const req = new NextRequest("http://localhost:3100/api/revalidate", {
      method: "POST",
      headers: {
        "x-revalidate-secret": "test-secret-value-123456",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tag: "products" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Etiket yenileme başarısız oldu");
    expect(data.error).not.toContain("Internal secret database error details");
  });
});
