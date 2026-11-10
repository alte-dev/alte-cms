import { describe, it, expect } from "vitest";
import {
  safeJsonLdStringify,
  generateJsonLdWebsite,
  generateJsonLdOrganization,
  generateJsonLdBlogPosting,
  generateJsonLdProduct,
  generateJsonLdBreadcrumbs,
} from "../lib/seo/json-ld";

describe("JSON-LD Generators & Escaping Security", () => {
  it("escapes '<' as '\\u003c' to prevent script injection", () => {
    const maliciousPayload = {
      title: "Malicious </script><script>alert('xss')</script>",
      content: "Test <tag>",
    };
    const jsonLd = safeJsonLdStringify(maliciousPayload);

    expect(jsonLd).not.toContain("<");
    expect(jsonLd).toContain("\\u003c/script>");
    expect(jsonLd).toContain("\\u003cscript>");
    expect(jsonLd).toContain("\\u003ctag>");
  });

  it("generates valid WebSite schema", () => {
    const jsonStr = generateJsonLdWebsite("Örnek Mağaza", "https://example.test");
    const parsed = JSON.parse(jsonStr);

    expect(parsed["@type"]).toBe("WebSite");
    expect(parsed.name).toBe("Örnek Mağaza");
    expect(parsed.url).toBe("https://example.test");
  });

  it("generates valid Organization schema", () => {
    const jsonStr = generateJsonLdOrganization("Örnek Mağaza", "https://example.test");
    const parsed = JSON.parse(jsonStr);

    expect(parsed["@type"]).toBe("Organization");
    expect(parsed.name).toBe("Örnek Mağaza");
  });

  it("generates valid BlogPosting schema with author and publisher", () => {
    const jsonStr = generateJsonLdBlogPosting({
      headline: "Stil Rehberi",
      description: "Yeni sezon rehberi",
      url: "https://example.test/blog/stil-rehberi",
      datePublished: "2026-11-08T00:00:00.000Z",
      authorName: "Örnek Yazar",
      publisherName: "Örnek Mağaza",
    });
    const parsed = JSON.parse(jsonStr);

    expect(parsed["@type"]).toBe("BlogPosting");
    expect(parsed.headline).toBe("Stil Rehberi");
    expect(parsed.author.name).toBe("Örnek Yazar");
    expect(parsed.publisher.name).toBe("Örnek Mağaza");
  });

  it("generates valid Product schema with Offer and availability", () => {
    const jsonStr = generateJsonLdProduct({
      name: "İpek Gömlek",
      description: "Saf ipek klasik kesim gömlek",
      url: "https://example.test/urun/ipek-gomlek",
      imageUrl: "https://example.test/media/gomlek.jpg",
      price: 1250,
      currency: "TRY",
      inStock: true,
      brandName: "Mağaza Markası",
    });
    const parsed = JSON.parse(jsonStr);

    expect(parsed["@type"]).toBe("Product");
    expect(parsed.name).toBe("İpek Gömlek");
    expect(parsed.brand?.name).toBe("Mağaza Markası");
    expect(parsed.offers["@type"]).toBe("Offer");
    expect(parsed.offers.price).toBe(1250);
    expect(parsed.offers.priceCurrency).toBe("TRY");
    expect(parsed.offers.availability).toBe("https://schema.org/InStock");
  });

  it("generates valid BreadcrumbList schema with sequential positions", () => {
    const jsonStr = generateJsonLdBreadcrumbs([
      { name: "Anasayfa", item: "https://example.test" },
      { name: "Giyim", item: "https://example.test/kategori/giyim" },
      { name: "İpek Gömlek", item: "https://example.test/urun/ipek-gomlek" },
    ]);
    const parsed = JSON.parse(jsonStr);

    expect(parsed["@type"]).toBe("BreadcrumbList");
    expect(parsed.itemListElement).toHaveLength(3);
    expect(parsed.itemListElement[0].position).toBe(1);
    expect(parsed.itemListElement[0].name).toBe("Anasayfa");
    expect(parsed.itemListElement[2].position).toBe(3);
    expect(parsed.itemListElement[2].name).toBe("İpek Gömlek");
  });
});
