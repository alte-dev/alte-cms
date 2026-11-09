import { describe, it, expect } from "vitest";
import {
  validatePuckData,
  PuckDataZodSchema,
  MAX_PUCK_PAYLOAD_BYTES,
  MAX_PUCK_COMPONENTS,
  MAX_PUCK_DEPTH,
} from "../lib/puck/schema";

describe("Puck Data Security & Structural Validation", () => {
  it("accepts valid Puck data structure with allowed components and valid props", () => {
    const validData = {
      content: [
        {
          id: "hero-1",
          type: "Hero",
          props: {
            title: "Yeni Sezon Koleksiyonu",
            subtitle: "En şık tasarımlar",
            primaryButtonText: "Alışverişe Başla",
            primaryButtonHref: "/urunler",
          },
        },
        {
          id: "featured-1",
          type: "ProductGrid",
          props: {
            title: "Öne Çıkanlar",
            limit: 4,
          },
        },
      ],
      root: {},
    };

    const res = validatePuckData(validData);
    expect(res.valid).toBe(true);
    expect(res.totalComponents).toBe(2);
    expect(PuckDataZodSchema.safeParse(validData).success).toBe(true);
  });

  it("rejects unknown component types", () => {
    const maliciousData = {
      content: [
        {
          type: "MaliciousRawHtmlBlock",
          props: { html: "<script>alert(1)</script>" },
        },
      ],
    };

    const res = validatePuckData(maliciousData);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Bilinmeyen bileşen tipi tespit edildi");
    expect(PuckDataZodSchema.safeParse(maliciousData).success).toBe(false);
  });

  it("rejects unknown properties in component props (strict mode)", () => {
    const dataWithUnknownProp = {
      content: [
        {
          type: "Hero",
          props: {
            title: "Başlık",
            unauthorizedInjectedField: "exploit",
          },
        },
      ],
    };

    const res = validatePuckData(dataWithUnknownProp);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/geçersiz veya bilinmeyen alan|unauthorizedInjectedField/);
  });

  it("rejects nested structures with buttons:[{href:'javascript:alert(1)'}]", () => {
    const nestedXssData = {
      content: [
        {
          type: "Hero",
          props: {
            title: "Hero",
          },
          buttons: [{ href: "javascript:alert(1)" }],
        },
      ],
    };

    const res = validatePuckData(nestedXssData);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Güvenli olmayan/);
  });

  it("rejects protocol-relative URL //evil.com", () => {
    const protocolRelativeData = {
      content: [
        {
          type: "Hero",
          props: {
            title: "Test",
            primaryButtonHref: "//evil.com",
          },
        },
      ],
    };

    const res = validatePuckData(protocolRelativeData);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Güvenli olmayan/);
  });

  it("rejects Windows UNC path \\\\evil", () => {
    const uncData = {
      content: [
        {
          type: "Hero",
          props: {
            title: "Test",
            primaryButtonHref: "\\\\evil\\share",
          },
        },
      ],
    };

    const res = validatePuckData(uncData);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Güvenli olmayan/);
  });

  it("rejects data: URI in links", () => {
    const dataUriData = {
      content: [
        {
          type: "ImageBlock",
          props: {
            src: "data:image/svg+xml;base64,PHN2Z...",
          },
        },
      ],
    };

    const res = validatePuckData(dataUriData);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Güvenli olmayan/);
  });

  it("rejects leading whitespace variant ' javascript:' and mixed case 'JaVa\\tScript:'", () => {
    const whitespaceXss = {
      content: [
        {
          type: "Hero",
          props: {
            primaryButtonHref: " javascript:alert(1)",
          },
        },
      ],
    };

    const mixedCaseXss = {
      content: [
        {
          type: "Hero",
          props: {
            primaryButtonHref: "JaVa\tScript:alert(1)",
          },
        },
      ],
    };

    expect(validatePuckData(whitespaceXss).valid).toBe(false);
    expect(validatePuckData(mixedCaseXss).valid).toBe(false);
  });

  it("rejects tree exceeding maximum component limit (> 200)", () => {
    const items = [];
    for (let i = 0; i < MAX_PUCK_COMPONENTS + 1; i++) {
      items.push({
        type: "Spacer",
        props: { height: "small" as const },
      });
    }

    const res = validatePuckData({ content: items });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Toplam bileşen sayısı izin verilen sınırı (200) aştı");
  });

  it("rejects nested structures exceeding maximum depth (> 6 levels)", () => {
    let current: any = {
      type: "Spacer",
      props: { height: "small" as const },
    };

    for (let d = 0; d < MAX_PUCK_DEPTH + 1; d++) {
      current = {
        type: "Columns",
        props: { columns: "2" as const },
        zones: {
          left: [current],
        },
      };
    }

    const res = validatePuckData({ content: [current] });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Bileşen iç içe derinliği izin verilen maksimum sınırı");
  });

  it("rejects payload exceeding 512 KB size limit", () => {
    const largeTitle = "A".repeat(520 * 1024); // 520 KB
    const largeData = {
      content: [
        {
          type: "Hero",
          props: { title: largeTitle },
        },
      ],
    };

    const res = validatePuckData(largeData);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("izin verilen 512 KB sınırını aşıyor");
  });
});
