import { describe, it, expect } from "vitest";
import {
  safeJsonLdStringify,
  generateJsonLdWebsite,
  generateJsonLdOrganization,
  generateJsonLdBlogPosting,
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
    const jsonStr = generateJsonLdWebsite("Çisem Elif Boz", "https://cisemelifboz.com");
    const parsed = JSON.parse(jsonStr);

    expect(parsed["@type"]).toBe("WebSite");
    expect(parsed.name).toBe("Çisem Elif Boz");
    expect(parsed.url).toBe("https://cisemelifboz.com");
  });

  it("generates valid Organization schema", () => {
    const jsonStr = generateJsonLdOrganization("Çisem Elif Boz", "https://cisemelifboz.com");
    const parsed = JSON.parse(jsonStr);

    expect(parsed["@type"]).toBe("Organization");
    expect(parsed.name).toBe("Çisem Elif Boz");
  });

  it("generates valid BlogPosting schema with author and publisher", () => {
    const jsonStr = generateJsonLdBlogPosting({
      headline: "Stil Rehberi",
      description: "Yeni sezon rehberi",
      url: "https://cisemelifboz.com/blog/stil-rehberi",
      datePublished: "2026-11-08T00:00:00.000Z",
      authorName: "Çisem Elif Boz",
    });
    const parsed = JSON.parse(jsonStr);

    expect(parsed["@type"]).toBe("BlogPosting");
    expect(parsed.headline).toBe("Stil Rehberi");
    expect(parsed.author.name).toBe("Çisem Elif Boz");
    expect(parsed.publisher.name).toBe("Çisem Elif Boz");
  });
});
