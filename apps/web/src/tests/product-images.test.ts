import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  resolveSafeImageUrl,
  resolveProductCardImage,
  resolveProductGalleryImages,
} from "../lib/medusa/product-images";
import { ProductCard } from "../components/product-card";
import { ProductImageGallery, stepGalleryIndex } from "../components/product-image-gallery";
import type { StoreProduct } from "../lib/medusa/types";

function makeProduct(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: "prod_test_1",
    title: "Test Deri Ceket",
    handle: "test-deri-ceket",
    thumbnail: null,
    images: [],
    variants: [
      {
        id: "var_1",
        title: "M",
        prices: [{ amount: 1490, currency_code: "try" }],
      },
    ],
    ...overrides,
  } as StoreProduct;
}

describe("Product Images & Gallery", () => {
  describe("resolveSafeImageUrl", () => {
    it("accepts https URLs and internal / paths", () => {
      expect(
        resolveSafeImageUrl(
          "https://images.pexels.com/photos/35145903/pexels-photo-35145903.jpeg?auto=compress&cs=tinysrgb&w=800",
        ),
      ).toBe(
        "https://images.pexels.com/photos/35145903/pexels-photo-35145903.jpeg?auto=compress&cs=tinysrgb&w=800",
      );
      expect(resolveSafeImageUrl("/api/media/file/ceket.jpg")).toBe("/api/media/file/ceket.jpg");
    });

    it("rejects unsafe schemes, protocol-relative URLs, and empty strings", () => {
      expect(resolveSafeImageUrl("javascript:alert(1)")).toBeNull();
      expect(resolveSafeImageUrl("data:image/svg+xml,<svg/>")).toBeNull();
      expect(resolveSafeImageUrl("//evil.example.test/img.jpg")).toBeNull();
      expect(resolveSafeImageUrl("\\\\evil.example.test\\img.jpg")).toBeNull();
      expect(resolveSafeImageUrl("   ")).toBeNull();
      expect(resolveSafeImageUrl(null)).toBeNull();
    });
  });

  describe("resolveProductCardImage", () => {
    it("returns thumbnail when valid, otherwise falls back to first safe image", () => {
      const withThumb = makeProduct({
        thumbnail: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg",
        images: [{ id: "img_1", url: "https://images.pexels.com/photos/2/pexels-photo-2.jpeg" }],
      });
      expect(resolveProductCardImage(withThumb)).toBe(
        "https://images.pexels.com/photos/1/pexels-photo-1.jpeg",
      );

      const onlyImages = makeProduct({
        thumbnail: null,
        images: [{ id: "img_1", url: "https://images.pexels.com/photos/2/pexels-photo-2.jpeg" }],
      });
      expect(resolveProductCardImage(onlyImages)).toBe(
        "https://images.pexels.com/photos/2/pexels-photo-2.jpeg",
      );

      const unsafe = makeProduct({
        thumbnail: "javascript:alert(1)",
        images: [{ id: "img_1", url: "data:text/html,bad" }],
      });
      expect(resolveProductCardImage(unsafe)).toBeNull();
    });
  });

  describe("resolveProductGalleryImages", () => {
    it("deduplicates thumbnail and images while filtering unsafe URLs", () => {
      const product = makeProduct({
        thumbnail: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg",
        images: [
          { id: "img_1", url: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg" },
          { id: "img_2", url: "https://images.pexels.com/photos/2/pexels-photo-2.jpeg" },
          { id: "img_bad", url: "javascript:void(0)" },
        ],
      });

      expect(resolveProductGalleryImages(product)).toEqual([
        { id: "thumbnail", url: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg" },
        { id: "img_2", url: "https://images.pexels.com/photos/2/pexels-photo-2.jpeg" },
      ]);
    });
  });

  describe("ProductCard", () => {
    it("renders product thumbnail img when available", () => {
      const product = makeProduct({
        thumbnail: "https://images.pexels.com/photos/35145903/pexels-photo-35145903.jpeg",
      });
      const html = renderToStaticMarkup(React.createElement(ProductCard, { product }));
      expect(html).toContain("<img");
      expect(html).toContain(
        'src="https://images.pexels.com/photos/35145903/pexels-photo-35145903.jpeg"',
      );
      expect(html).toContain('alt="Test Deri Ceket"');
    });

    it("falls back to PlaceholderImage when no safe image exists", () => {
      const product = makeProduct({ thumbnail: null, images: [] });
      const html = renderToStaticMarkup(React.createElement(ProductCard, { product }));
      expect(html).not.toContain("<img");
      expect(html).toContain('aria-label="Test Deri Ceket"');
    });
  });

  describe("ProductImageGallery", () => {
    it("wraps gallery index forward and backward cleanly", () => {
      expect(stepGalleryIndex(0, 1, 2)).toBe(1);
      expect(stepGalleryIndex(1, 1, 2)).toBe(0);
      expect(stepGalleryIndex(0, -1, 2)).toBe(1);
      expect(stepGalleryIndex(0, 1, 0)).toBe(0);
    });

    it("renders interactive thumbnail buttons and prev/next controls when multiple images exist", () => {
      const images = [
        { id: "img_1", url: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg" },
        { id: "img_2", url: "https://images.pexels.com/photos/2/pexels-photo-2.jpeg" },
      ];
      const html = renderToStaticMarkup(
        React.createElement(ProductImageGallery, { title: "Test Deri Ceket", images }),
      );
      expect(html).toContain('aria-label="Önceki görsel"');
      expect(html).toContain('aria-label="Sonraki görsel"');
      expect(html).toContain('aria-label="Test Deri Ceket - Görsel 1"');
      expect(html).toContain('aria-label="Test Deri Ceket - Görsel 2"');
      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain('aria-pressed="false"');
      expect(html).toContain("1 / 2");
    });

    it("renders PlaceholderImage when images array is empty", () => {
      const html = renderToStaticMarkup(
        React.createElement(ProductImageGallery, { title: "Boş Ürün", images: [] }),
      );
      expect(html).not.toContain("<img");
      expect(html).toContain('aria-label="Boş Ürün"');
    });
  });
});
