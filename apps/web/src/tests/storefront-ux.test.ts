import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@payload-config", () => ({ default: {} }));

import * as productsLib from "../lib/medusa/products";
import * as contentLib from "../lib/payload/content";
import {
  ServerProductGridComponent,
  ServerFeaturedProductsComponent,
  ServerCategoryListComponent,
  ServerLatestPostsComponent,
} from "../lib/puck/server-blocks";
import { shouldStartNavigationProgress } from "../components/navigation-progress";
import { MIN_INFINITE_SCROLL_DELAY_MS, waitMinDelay } from "../components/infinite-product-grid";

describe("Storefront UX: Clickable Puck Blocks, Navigation Progress & Infinite Scroll Delay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Puck Server Blocks (Homepage Products & Blog Posts)", () => {
    it("ServerProductGridComponent renders real products with /urun/<handle> links and /urunler view-all link", async () => {
      vi.spyOn(productsLib, "getProducts").mockResolvedValueOnce({
        products: [
          {
            id: "prod_1",
            title: "Keten Gömlek",
            handle: "keten-gomlek",
            variants: [{ id: "var_1", prices: [{ amount: 899, currency_code: "try" }] }],
          } as never,
        ],
        count: 1,
        totalPages: 1,
        currentPage: 1,
      });

      const el = await ServerProductGridComponent({ title: "Öne Çıkanlar", limit: 4 });
      const html = renderToStaticMarkup(el);

      expect(html).toContain('href="/urun/keten-gomlek"');
      expect(html).toContain("Keten Gömlek");
      expect(html).toContain('href="/urunler"');
      expect(html).not.toContain("/magaza");
    });

    it("ServerFeaturedProductsComponent renders clickable product cards", async () => {
      vi.spyOn(productsLib, "getProducts").mockResolvedValueOnce({
        products: [
          {
            id: "prod_2",
            title: "Özel Ceket",
            handle: "ozel-ceket",
            variants: [{ id: "var_2", prices: [{ amount: 1500, currency_code: "try" }] }],
          } as never,
        ],
        count: 1,
        totalPages: 1,
        currentPage: 1,
      });

      const el = await ServerFeaturedProductsComponent({
        title: "Haftanın Seçimleri",
        subtitle: "Özel seçki",
      });
      const html = renderToStaticMarkup(el);

      expect(html).toContain('href="/urun/ozel-ceket"');
      expect(html).toContain("Özel Ceket");
    });

    it("ServerLatestPostsComponent renders real blog posts with /blog/<slug> links", async () => {
      vi.spyOn(contentLib, "getPublishedPosts").mockResolvedValueOnce({
        docs: [
          {
            id: "post_1",
            title: "Yeni Sezon Rehberi",
            slug: "yeni-sezon-rehberi",
            excerpt: "Kısa özet",
            createdAt: "2026-11-08T10:00:00.000Z",
          },
        ],
        totalDocs: 1,
        totalPages: 1,
        page: 1,
      } as never);

      const el = await ServerLatestPostsComponent({ title: "Blogdan Son Yazılar", limit: 3 });
      const html = renderToStaticMarkup(el);

      expect(html).toContain('href="/blog/yeni-sezon-rehberi"');
      expect(html).toContain("Yeni Sezon Rehberi");
      expect(html).toContain('href="/blog"');
    });

    it("ServerCategoryListComponent renders real category links", async () => {
      vi.spyOn(productsLib, "getCategories").mockResolvedValueOnce([
        { id: "cat_1", name: "Giyim", handle: "giyim" } as never,
      ]);

      const el = await ServerCategoryListComponent({ title: "Kategoriler" });
      const html = renderToStaticMarkup(el);

      expect(html).toContain('href="/kategori/giyim"');
      expect(html).toContain("Giyim");
    });
  });

  describe("Navigation Progress Bar Guard", () => {
    const makeAnchor = (attrs: Record<string, string>) => {
      const hasDownload = "download" in attrs;
      return {
        href: attrs.href || "",
        getAttribute: (name: string) => (name in attrs ? attrs[name] : null),
        hasAttribute: (name: string) => (name === "download" ? hasDownload : name in attrs),
      } as unknown as HTMLAnchorElement;
    };

    const normalClick = {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
    };

    it("starts progress for internal navigation to a different path", () => {
      const anchor = makeAnchor({ href: "http://localhost:3100/hakkimizda" });
      expect(
        shouldStartNavigationProgress(
          anchor,
          normalClick,
          "http://localhost:3100/",
          "http://localhost:3100",
        ),
      ).toBe(true);
    });

    it("ignores same-URL, hash, external, target=_blank, download, and modified clicks", () => {
      expect(
        shouldStartNavigationProgress(
          makeAnchor({ href: "http://localhost:3100/urunler" }),
          normalClick,
          "http://localhost:3100/urunler",
          "http://localhost:3100",
        ),
      ).toBe(false);

      expect(
        shouldStartNavigationProgress(
          makeAnchor({ href: "#top" }),
          normalClick,
          "http://localhost:3100/",
          "http://localhost:3100",
        ),
      ).toBe(false);

      expect(
        shouldStartNavigationProgress(
          makeAnchor({ href: "https://example.test/out" }),
          normalClick,
          "http://localhost:3100/",
          "http://localhost:3100",
        ),
      ).toBe(false);

      expect(
        shouldStartNavigationProgress(
          makeAnchor({ href: "http://localhost:3100/blog", target: "_blank" }),
          normalClick,
          "http://localhost:3100/",
          "http://localhost:3100",
        ),
      ).toBe(false);

      expect(
        shouldStartNavigationProgress(
          makeAnchor({ href: "http://localhost:3100/file.pdf", download: "" }),
          normalClick,
          "http://localhost:3100/",
          "http://localhost:3100",
        ),
      ).toBe(false);

      expect(
        shouldStartNavigationProgress(
          makeAnchor({ href: "http://localhost:3100/blog" }),
          { ...normalClick, ctrlKey: true },
          "http://localhost:3100/",
          "http://localhost:3100",
        ),
      ).toBe(false);
    });
  });

  describe("Infinite Scroll Minimum 500ms Loading Delay", () => {
    it("exports MIN_INFINITE_SCROLL_DELAY_MS as 500ms", () => {
      expect(MIN_INFINITE_SCROLL_DELAY_MS).toBe(500);
    });

    it("waitMinDelay waits at least the requested duration", async () => {
      vi.useFakeTimers();
      let resolved = false;
      const promise = waitMinDelay(500).then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(499);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await promise;
      expect(resolved).toBe(true);
      vi.useRealTimers();
    });
  });
});
