import { describe, it, expect } from "vitest";
import {
  generateJsonLdProduct,
  generateJsonLdBreadcrumbs,
  generateJsonLdBlogPosting,
  generateJsonLdOrganization,
  safeJsonLdStringify,
} from "../lib/seo/json-ld";

describe("SEO Structured Data & JSON-LD Compliance (11D)", () => {
  it("must generate fully valid schema.org Product with required fields and dynamic brand", () => {
    const jsonStr = generateJsonLdProduct({
      name: "Örnek Sade Keten Gömlek",
      description: "Doğal keten kumaş, nefes alan yapı.",
      url: "https://example.test/urun/keten-gomlek",
      imageUrl: "https://example.test/media/keten-gomlek.png",
      price: 850,
      currency: "TRY",
      inStock: true,
      brandName: "Alte Doğal Yaşam",
    });

    const parsed = JSON.parse(jsonStr);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("Product");
    expect(parsed.name).toBe("Örnek Sade Keten Gömlek");
    expect(parsed.description).toBe("Doğal keten kumaş, nefes alan yapı.");
    expect(parsed.brand?.name).toBe("Alte Doğal Yaşam");

    // Offers validation
    expect(parsed.offers).toBeDefined();
    expect(parsed.offers["@type"]).toBe("Offer");
    expect(parsed.offers.price).toBe(850);
    expect(parsed.offers.priceCurrency).toBe("TRY");
    expect(parsed.offers.availability).toBe("https://schema.org/InStock");
    expect(parsed.offers.itemCondition).toBe("https://schema.org/NewCondition");
    expect(parsed.offers.url).toBe("https://example.test/urun/keten-gomlek");
  });

  it("must reflect out-of-stock availability correctly in Product schema", () => {
    const jsonStr = generateJsonLdProduct({
      name: "Tükenmiş Ürün",
      url: "https://example.test/urun/tukenmis",
      price: 500,
      inStock: false,
    });

    const parsed = JSON.parse(jsonStr);
    expect(parsed.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("must generate valid BreadcrumbList schema with sequential positions", () => {
    const crumbs = [
      { name: "Anasayfa", item: "https://example.test" },
      { name: "Giyim", item: "https://example.test/kategori/giyim" },
      { name: "Gömlekler", item: "https://example.test/kategori/gomlekler" },
      { name: "Keten Gömlek", item: "https://example.test/urun/keten-gomlek" },
    ];

    const jsonStr = generateJsonLdBreadcrumbs(crumbs);
    const parsed = JSON.parse(jsonStr);

    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("BreadcrumbList");
    expect(parsed.itemListElement).toHaveLength(4);

    parsed.itemListElement.forEach((el: any, idx: number) => {
      expect(el["@type"]).toBe("ListItem");
      expect(el.position).toBe(idx + 1);
      expect(el.name).toBe(crumbs[idx].name);
      expect(el.item).toBe(crumbs[idx].item);
    });
  });

  it("must generate valid BlogPosting schema with author, publisher, and dates", () => {
    const jsonStr = generateJsonLdBlogPosting({
      headline: "2026 Keten Kumaş Trendleri",
      description: "Doğal liflerin yükselişi ve bakım önerileri.",
      url: "https://example.test/blog/keten-trendleri",
      datePublished: "2026-11-01T10:00:00Z",
      dateModified: "2026-11-05T12:00:00Z",
      authorName: "Ayşe Editör",
      publisherName: "Mağaza Yayıncılık",
      publisherLogo: "https://example.test/media/logo.png",
      imageUrl: "https://example.test/media/cover.png",
    });

    const parsed = JSON.parse(jsonStr);
    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("BlogPosting");
    expect(parsed.headline).toBe("2026 Keten Kumaş Trendleri");
    expect(parsed.author["@type"]).toBe("Person");
    expect(parsed.author.name).toBe("Ayşe Editör");
    expect(parsed.publisher["@type"]).toBe("Organization");
    expect(parsed.publisher.name).toBe("Mağaza Yayıncılık");
    expect(parsed.publisher.logo.url).toBe("https://example.test/media/logo.png");
    expect(parsed.datePublished).toBe("2026-11-01T10:00:00Z");
    expect(parsed.dateModified).toBe("2026-11-05T12:00:00Z");
  });

  it("must generate valid Organization schema without hardcoded domains", () => {
    const jsonStr = generateJsonLdOrganization(
      "Örnek Mağaza A.Ş.",
      "https://example.test",
      "https://example.test/media/logo.png",
    );

    const parsed = JSON.parse(jsonStr);
    expect(parsed["@type"]).toBe("Organization");
    expect(parsed.name).toBe("Örnek Mağaza A.Ş.");
    expect(parsed.url).toBe("https://example.test");
    expect(parsed.logo).toBe("https://example.test/media/logo.png");
  });

  it("strictly neutralizes script tags in any stringified JSON-LD payload", () => {
    const raw = {
      title: "Güvenlik Testi </script><script>alert('XSS')</script>",
      html: "<img src=x onerror=alert(1)>",
    };

    const serialized = safeJsonLdStringify(raw);
    expect(serialized).not.toContain("<script>");
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c");
  });
});
