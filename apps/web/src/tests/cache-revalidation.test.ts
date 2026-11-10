import { describe, it, expect } from "vitest";
import { CACHE_TAGS, revalidateContentTag } from "../lib/cache-tags";
import { POST } from "../app/api/revalidate/route";
import { NextRequest } from "next/server";

describe("Cache Strategy & Revalidation (revalidateTag)", () => {
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

  it("safely handles revalidation outside request context", () => {
    // Calling revalidateContentTag in test environment without active request should not throw
    expect(() => revalidateContentTag("test-tag")).not.toThrow();
  });

  it("POST /api/revalidate rejects requests without valid secret", async () => {
    process.env.PAYLOAD_SECRET = "test-secret-value-123456";

    const req = new NextRequest("http://localhost:3100/api/revalidate", {
      method: "POST",
      body: JSON.stringify({ tag: "products" }),
    });

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
    const json = await res.json();
    expect(json.revalidated).toBe(true);
    expect(json.tag).toBe("pages");
  });
});
