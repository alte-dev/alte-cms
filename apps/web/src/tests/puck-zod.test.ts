import { describe, it, expect } from "vitest";
import {
  validatePuckData,
  PuckDataZodSchema,
  MAX_PUCK_PAYLOAD_BYTES,
  MAX_PUCK_COMPONENTS,
  MAX_PUCK_DEPTH,
} from "../lib/puck/schema";

describe("Puck Data Security & Structural Validation", () => {
  it("accepts valid Puck data structure with allowed components", () => {
    const validData = {
      content: [
        {
          type: "Hero",
          props: {
            id: "hero-1",
            title: "Yeni Sezon Koleksiyonu",
            subtitle: "En şık tasarımlar",
            primaryButtonText: "Alışverişe Başla",
            primaryButtonUrl: "/urunler",
          },
        },
        {
          type: "FeaturedProducts",
          props: {
            id: "featured-1",
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

  it("rejects component props containing dangerous javascript: links", () => {
    const xssData = {
      content: [
        {
          type: "Hero",
          props: {
            title: "Tıkla",
            primaryButtonUrl: "javascript:alert('XSS')",
          },
        },
      ],
    };

    const res = validatePuckData(xssData);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("güvenli olmayan bir bağlantı içeriyor");
  });

  it("rejects tree exceeding maximum component limit (> 200)", () => {
    const items = [];
    for (let i = 0; i < MAX_PUCK_COMPONENTS + 1; i++) {
      items.push({
        type: "Spacer",
        props: { id: `spacer-${i}`, height: 20 },
      });
    }

    const res = validatePuckData({ content: items });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Toplam bileşen sayısı izin verilen sınırı (200) aştı");
  });

  it("rejects nested structures exceeding maximum depth (> 6 levels)", () => {
    // Build nested columns of depth 7
    let current: any = {
      type: "Spacer",
      props: { height: 10 },
    };

    for (let d = 0; d < MAX_PUCK_DEPTH + 1; d++) {
      current = {
        type: "Columns",
        props: {},
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
