import { describe, it, expect, vi, beforeEach } from "vitest";
import * as sitemapModule from "../app/sitemap";
import * as productsLib from "../lib/medusa/products";
import * as contentLib from "../lib/payload/content";

vi.mock("../lib/medusa/products", () => ({
  getCategories: vi.fn(),
  getProducts: vi.fn(),
}));

vi.mock("../lib/payload/content", () => ({
  getPayloadClient: vi.fn(),
}));

describe("Sitemap Dynamic Configuration & Fail-Closed Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports dynamic = 'force-dynamic' so sitemaps never freeze at build time", () => {
    expect((sitemapModule as Record<string, unknown>).dynamic).toBe("force-dynamic");
  });

  it("throws when getCategories fails on partition 0 instead of swallowing error", async () => {
    vi.mocked(productsLib.getCategories).mockRejectedValueOnce(
      new Error("Medusa connection failed"),
    );

    await expect(sitemapModule.default({ id: "0" })).rejects.toThrow("Medusa connection failed");
  });

  it("throws when getProducts fails on partition 1 instead of returning empty 200 sitemap", async () => {
    vi.mocked(productsLib.getProducts).mockRejectedValueOnce(new Error("Medusa products error"));

    await expect(sitemapModule.default({ id: "1" })).rejects.toThrow("Medusa products error");
  });

  it("throws when Payload DB fails on partition 2 instead of returning empty 200 sitemap", async () => {
    vi.mocked(contentLib.getPayloadClient).mockRejectedValueOnce(
      new Error("Database connection error"),
    );

    await expect(sitemapModule.default({ id: "2" })).rejects.toThrow("Database connection error");
  });

  it("includes published non-noIndex pages and excludes reserved/noIndex slugs in partition 2", async () => {
    const mockFind = vi
      .fn()
      .mockResolvedValueOnce({
        docs: [
          {
            slug: "hakkimizda",
            updatedAt: "2026-11-10T10:00:00.000Z",
            isHome: false,
            seo: { noIndex: false },
          },
          {
            slug: "gizli-sayfa",
            updatedAt: "2026-11-10T10:00:00.000Z",
            isHome: false,
            seo: { noIndex: true },
          },
          { slug: "urunler", updatedAt: "2026-11-10T10:00:00.000Z", isHome: false },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          { slug: "ilk-yazi", updatedAt: "2026-11-10T10:00:00.000Z", seo: { noIndex: false } },
        ],
      })
      .mockResolvedValueOnce({
        docs: [{ slug: "rehber", updatedAt: "2026-11-10T10:00:00.000Z" }],
      });

    vi.mocked(contentLib.getPayloadClient).mockResolvedValueOnce({
      find: mockFind,
    } as never);

    const urls = await sitemapModule.default({ id: "2" });
    const urlStrings = urls.map((u) => u.url);

    expect(urlStrings.some((u) => u.endsWith("/sayfa/hakkimizda"))).toBe(true);
    expect(urlStrings.some((u) => u.endsWith("/blog/ilk-yazi"))).toBe(true);
    expect(urlStrings.some((u) => u.endsWith("/blog/kategori/rehber"))).toBe(true);
    expect(urlStrings.some((u) => u.endsWith("/sayfa/gizli-sayfa"))).toBe(false);
    expect(urlStrings.some((u) => u.endsWith("/sayfa/urunler"))).toBe(false);
  });
});
