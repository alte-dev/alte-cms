import { describe, it, expect } from "vitest";
import {
  validatePuckData,
  PuckDataZodSchema,
  ALLOWED_PUCK_COMPONENTS,
  COMPONENT_PROP_SCHEMAS,
  MAX_PUCK_PAYLOAD_BYTES,
  MAX_PUCK_COMPONENTS,
  MAX_PUCK_DEPTH,
} from "../lib/puck/schema";
import { puckConfig } from "../lib/puck/config";
import realPuckFixture from "./fixtures/puck-real-output.json";
import { z } from "zod";

describe("Puck Data Security & Structural Validation", () => {
  it("accepts real editor output fixture containing all 14 components with props.id", () => {
    const res = validatePuckData(realPuckFixture);
    expect(res.valid).toBe(true);
    expect(res.totalComponents).toBe(14);
    expect(PuckDataZodSchema.safeParse(realPuckFixture).success).toBe(true);
  });

  it("strictly enforces two-way schema and config field parity for all components", () => {
    const configComponents = Object.keys(puckConfig.components).sort();
    const allowedComponents = [...ALLOWED_PUCK_COMPONENTS].sort();
    const schemaComponents = Object.keys(COMPONENT_PROP_SCHEMAS).sort();

    // Verify all components exist across config, allowed list, and schemas
    expect(configComponents).toEqual(allowedComponents);
    expect(configComponents).toEqual(schemaComponents);

    for (const compName of ALLOWED_PUCK_COMPONENTS) {
      const configEntry = puckConfig.components[compName];
      const configFields = Object.keys(configEntry.fields || {}).sort();
      const expectedShapeKeys = [...configFields, "id"].sort();

      const schema = COMPONENT_PROP_SCHEMAS[compName] as z.ZodObject<z.ZodRawShape>;
      expect(schema).toBeDefined();
      expect(schema.shape).toBeDefined();

      const schemaKeys = Object.keys(schema.shape).sort();
      expect(schemaKeys).toEqual(expectedShapeKeys);
    }
  });

  it("accepts valid Puck data structure with allowed components and valid props.id", () => {
    const validData = {
      root: { props: { title: "Ana Sayfa" } },
      content: [
        {
          type: "Hero",
          props: {
            id: "hero-1",
            title: "Yeni Sezon Koleksiyonu",
            subtitle: "En şık tasarımlar",
            primaryButtonText: "Alışverişe Başla",
            primaryButtonHref: "/urunler",
          },
        },
        {
          type: "ProductGrid",
          props: {
            id: "featured-1",
            title: "Öne Çıkanlar",
            limit: 4,
          },
        },
      ],
      zones: {},
    };

    const res = validatePuckData(validData);
    expect(res.valid).toBe(true);
    expect(res.totalComponents).toBe(2);
    expect(PuckDataZodSchema.safeParse(validData).success).toBe(true);
  });

  it("accepts valid internal paths (/urunler) and valid https:// URLs", () => {
    const validLinksData = {
      content: [
        {
          type: "Hero",
          props: {
            id: "hero-links",
            primaryButtonHref: "/urunler",
            secondaryButtonHref: "https://example.com/kampanya",
          },
        },
      ],
    };

    const res = validatePuckData(validLinksData);
    expect(res.valid).toBe(true);
  });

  it("rejects unknown component types", () => {
    const maliciousData = {
      content: [
        {
          type: "MaliciousRawHtmlBlock",
          props: { id: "bad-1", html: "<script>alert(1)</script>" },
        },
      ],
    };

    const res = validatePuckData(maliciousData);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Bilinmeyen bileşen tipi tespit edildi");
    expect(PuckDataZodSchema.safeParse(maliciousData).success).toBe(false);
  });

  it("rejects components missing props.id", () => {
    const missingIdData = {
      content: [
        {
          type: "Hero",
          props: {
            title: "Eksik ID",
          },
        },
      ],
    };

    const res = validatePuckData(missingIdData);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/id/);
  });

  it("rejects unknown properties in component props (strict mode)", () => {
    const dataWithUnknownProp = {
      content: [
        {
          type: "Hero",
          props: {
            id: "hero-unknown-prop",
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

  it("rejects unknown properties in root.props (strict mode)", () => {
    const dataWithBadRoot = {
      root: {
        props: {
          title: "Sayfa",
          injectedRootProp: "malicious",
        },
      },
      content: [],
    };

    const res = validatePuckData(dataWithBadRoot);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Root bileşeni geçersiz veya bilinmeyen alan içeriyor/);
  });

  it("rejects nested structures with buttons:[{href:'javascript:alert(1)'}]", () => {
    const nestedXssData = {
      content: [
        {
          type: "Hero",
          props: {
            id: "hero-nested-xss",
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
            id: "hero-proto",
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
            id: "hero-unc",
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

  it("rejects data: URI in links and image src", () => {
    const dataUriData = {
      content: [
        {
          type: "ImageBlock",
          props: {
            id: "img-data-uri",
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
            id: "hero-ws",
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
            id: "hero-mc",
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
        props: { id: `spacer-${i}`, height: "small" as const },
      });
    }

    const res = validatePuckData({ content: items });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Toplam bileşen sayısı izin verilen sınırı (200) aştı");
  });

  it("rejects nested structures exceeding maximum depth (> 6 levels)", () => {
    let current: any = {
      type: "Spacer",
      props: { id: "spacer-leaf", height: "small" as const },
    };

    for (let d = 0; d < MAX_PUCK_DEPTH + 1; d++) {
      current = {
        type: "Columns",
        props: { id: `col-${d}`, columns: "2" as const },
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
          props: { id: "hero-huge", title: largeTitle },
        },
      ],
    };

    const res = validatePuckData(largeData);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("izin verilen 512 KB sınırını aşıyor");
  });
});
