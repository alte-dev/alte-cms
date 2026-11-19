import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.fn();
vi.mock("payload", () => ({
  getPayload: vi.fn(async () => ({
    auth: mockAuth,
    config: { cookiePrefix: "payload" },
  })),
}));

vi.mock("@payload-config", () => ({
  default: {},
}));

import { revalidateTag, revalidatePath } from "next/cache";
import {
  isNonCacheablePath,
  extractLocUrlsFromXml,
  collectWarmableUrls,
  warmStorefrontCache,
  purgeAllStorefrontCache,
  getLastWarmSummary,
  resetWarmStateForTests,
} from "../lib/cache-warmer";
import { GET, POST } from "../app/api/admin/cache/route";

describe("Cache Warmer & Non-Cacheable Route Guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWarmStateForTests();
  });

  it("blocks cart, checkout, account, admin, and api routes from caching/warming", () => {
    const blocked = [
      "/sepet",
      "/sepet/detay",
      "/odeme",
      "/odeme/3d-secure",
      "/hesap",
      "/hesap/siparisler",
      "/siparis-onay",
      "/siparis-onay/ord_123",
      "/siparis-takip",
      "/onizleme",
      "/onizleme/page-1",
      "/admin",
      "/admin/collections/pages",
      "/app",
      "/app/orders",
      "/api/cart",
      "/api/admin/cache",
      "/medusa-api/admin/products",
      "/ara",
    ];
    for (const p of blocked) {
      expect(isNonCacheablePath(p), `Expected ${p} to be blocked`).toBe(true);
    }

    const allowed = [
      "/",
      "/urunler",
      "/urun/ipek-elbise",
      "/kategori/giyim",
      "/blog",
      "/blog/yazi-1",
      "/hakkimizda",
      "/iletisim",
    ];
    for (const p of allowed) {
      expect(isNonCacheablePath(p), `Expected ${p} to be allowed`).toBe(false);
    }
  });

  it("extracts <loc> URLs from sitemap XML", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.test/</loc></url>
        <url><loc>https://example.test/urunler</loc></url>
      </urlset>`;
    expect(extractLocUrlsFromXml(xml)).toEqual([
      "https://example.test/",
      "https://example.test/urunler",
    ]);
  });

  it("collects warmable URLs from sitemapindex, rewrites to local baseUrl, and filters blocked paths", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/sitemap.xml")) {
        return new Response(
          `<sitemapindex>
            <sitemap><loc>https://public.example.test/sitemap/0.xml</loc></sitemap>
            <sitemap><loc>https://public.example.test/sitemap/1.xml</loc></sitemap>
          </sitemapindex>`,
          { status: 200 },
        );
      }
      if (url.endsWith("/sitemap/0.xml")) {
        return new Response(
          `<urlset>
            <url><loc>https://public.example.test/</loc></url>
            <url><loc>https://public.example.test/sepet</loc></url>
            <url><loc>https://public.example.test/odeme</loc></url>
          </urlset>`,
          { status: 200 },
        );
      }
      if (url.endsWith("/sitemap/1.xml")) {
        return new Response(
          `<urlset>
            <url><loc>https://public.example.test/urun/test-urun</loc></url>
            <url><loc>https://public.example.test/admin</loc></url>
            <url><loc>https://public.example.test/urun/test-urun</loc></url>
          </urlset>`,
          { status: 200 },
        );
      }
      return new Response("Not Found", { status: 404 });
    });

    const result = await collectWarmableUrls("http://127.0.0.1:3100", mockFetch);
    expect(result.urls).toEqual(["http://127.0.0.1:3100/", "http://127.0.0.1:3100/urun/test-urun"]);
    expect(result.skipped).toBe(3); // /sepet, /odeme, /admin
  });

  it("blocks protocol-relative SSRF paths (//evil.example.test) from escaping base origin", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/sitemap.xml")) {
        return new Response(
          `<urlset>
            <url><loc>https://public.example.test//evil.example.test/steal</loc></url>
            <url><loc>https://public.example.test/urunler</loc></url>
          </urlset>`,
          { status: 200 },
        );
      }
      return new Response("Not Found", { status: 404 });
    });

    const result = await collectWarmableUrls("http://127.0.0.1:3100", mockFetch);
    expect(result.urls).toEqual(["http://127.0.0.1:3100/urunler"]);
    expect(result.skipped).toBe(1);
    for (const u of result.urls) {
      expect(new URL(u).origin).toBe("http://127.0.0.1:3100");
    }
  });

  it("warms storefront URLs and records summary with success and failure counts", async () => {
    const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/sitemap.xml")) {
        return new Response(
          `<urlset>
            <url><loc>http://127.0.0.1:3100/</loc></url>
            <url><loc>http://127.0.0.1:3100/urunler</loc></url>
            <url><loc>http://127.0.0.1:3100/bozuk</loc></url>
          </urlset>`,
          { status: 200 },
        );
      }
      if (url.endsWith("/bozuk")) {
        return new Response("Error", { status: 500 });
      }
      return new Response("<html>OK</html>", { status: 200 });
    });

    const summary = await warmStorefrontCache({
      baseUrl: "http://127.0.0.1:3100",
      fetchImpl: mockFetch,
    });

    expect(summary.status).toBe("completed");
    expect(summary.totalUrls).toBe(3);
    expect(summary.scanned).toBe(3);
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.durationMs).toBeTypeOf("number");
    expect(getLastWarmSummary()).toEqual(summary);
  });

  it("purges all storefront cache tags and root layout path", () => {
    const result = purgeAllStorefrontCache();
    expect(result.purged).toBe(true);
    expect(result.tags).toEqual(
      expect.arrayContaining([
        "products",
        "categories",
        "blog",
        "pages",
        "navigation",
        "site-settings",
        "sitemap",
      ]),
    );
    expect(revalidateTag).toHaveBeenCalledTimes(7);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("Admin Cache API (/api/admin/cache)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWarmStateForTests();
  });

  it("rejects unauthenticated requests with 401", async () => {
    mockAuth.mockResolvedValueOnce({ user: null });
    const req = new NextRequest("http://localhost:3100/api/admin/cache", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("rejects editor and shop-manager roles with 403", async () => {
    for (const role of ["editor", "shop-manager"]) {
      mockAuth.mockResolvedValueOnce({ user: { id: "u1", role, email: "staff@example.test" } });
      const req = new NextRequest("http://localhost:3100/api/admin/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "purge" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    }
  });

  it("rejects invalid action payload with 400", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "u1", role: "admin", email: "admin@example.test" },
    });
    const req = new NextRequest("http://localhost:3100/api/admin/cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "invalid" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("allows admin to purge cache and sets no-store Cache-Control", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "u1", role: "admin", email: "admin@example.test" },
    });
    const req = new NextRequest("http://localhost:3100/api/admin/cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "purge" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.action).toBe("purge");
    expect(revalidateTag).toHaveBeenCalled();
  });

  it("rejects cross-origin POST requests with 403 (CSRF protection)", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "u1", role: "admin", email: "admin@example.test" },
    });
    const req = new NextRequest("http://localhost:3100/api/admin/cache", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example.test",
        Host: "localhost:3100",
      },
      body: JSON.stringify({ action: "purge" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("starts warm asynchronously with 202 Accepted and returns 409 on concurrent warm", async () => {
    let releaseFetch!: () => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      releaseFetch = () =>
        resolve(
          new Response("<urlset><url><loc>http://127.0.0.1:3100/</loc></url></urlset>", {
            status: 200,
          }),
        );
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => pendingFetch);
    fetchSpy.mockImplementationOnce(async () => new Response("<html>OK</html>", { status: 200 }));

    mockAuth.mockResolvedValue({
      user: { id: "u1", role: "admin", email: "admin@example.test" },
    });

    const req1 = new NextRequest("http://localhost:3100/api/admin/cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "warm" }),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(202);
    const data1 = await res1.json();
    expect(data1.ok).toBe(true);
    expect(data1.summary.status).toBe("running");

    const req2 = new NextRequest("http://localhost:3100/api/admin/cache", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "warm" }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(409);

    releaseFetch();
    await new Promise((r) => setTimeout(r, 20));
    fetchSpy.mockRestore();
  });
});
