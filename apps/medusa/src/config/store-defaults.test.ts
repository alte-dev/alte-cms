import { describe, expect, it } from "vitest";
import {
  assertProductionPaymentConfigured,
  normalizeTurkishSlug,
  STORE_DEFAULTS,
  StoreDefaultsSchema,
} from "./store-defaults";

describe("store-defaults", () => {
  describe("Turkish Slug Normalizer", () => {
    it("normalizes Turkish diacritics to clean ASCII slugs", () => {
      expect(normalizeTurkishSlug("Giyim")).toBe("giyim");
      expect(normalizeTurkishSlug("Üst Giyim")).toBe("ust-giyim");
      expect(normalizeTurkishSlug("Alt Giyim")).toBe("alt-giyim");
      expect(normalizeTurkishSlug("Ev & Yaşam")).toBe("ev-yasam");
      expect(normalizeTurkishSlug("Örnek Mağaza")).toBe("ornek-magaza");
      expect(normalizeTurkishSlug("Şık & Özgün Ürünler!")).toBe("sik-ozgun-urunler");
      expect(normalizeTurkishSlug("   Çok---Acil   Şeyler!   ")).toBe("cok-acil-seyler");
    });

    it("handles uppercase and dotted/dotless I correctly", () => {
      expect(normalizeTurkishSlug("IŞIK")).toBe("isik");
      expect(normalizeTurkishSlug("İSTANBUL")).toBe("istanbul");
    });
  });

  describe("assertProductionPaymentConfigured", () => {
    it("allows default provider in development mode", () => {
      expect(assertProductionPaymentConfigured(["pp_system_default"], "development")).toBe(true);
    });

    it("fails closed if pp_system_default is present in production", () => {
      expect(() =>
        assertProductionPaymentConfigured(["pp_system_default"], "production"),
      ).toThrowError(/strictly prohibited in production/);
    });

    it("fails closed if no providers are configured in production", () => {
      expect(() => assertProductionPaymentConfigured([], "production")).toThrowError(
        /No payment providers configured/,
      );
    });

    it("passes in production with certified payment provider", () => {
      expect(assertProductionPaymentConfigured(["pp_paytr"], "production")).toBe(true);
    });
  });

  describe("StoreDefaultsSchema", () => {
    it("validates STORE_DEFAULTS constant successfully", () => {
      const parsed = StoreDefaultsSchema.safeParse(STORE_DEFAULTS);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.store.default_currency_code).toBe("try");
        expect(parsed.data.region.currency_code).toBe("try");
        expect(parsed.data.region.is_tax_inclusive).toBe(true);
        expect(parsed.data.tax_rates).toHaveLength(3);
        expect(parsed.data.fulfillment.shipping_options).toHaveLength(3);
      }
    });

    it("rejects invalid tax rates (> 100 or < 0)", () => {
      const invalid = {
        ...STORE_DEFAULTS,
        tax_rates: [
          {
            code: "INVALID",
            name: "Invalid",
            rate: 120,
            is_default: false,
            product_type_value: null,
          },
        ],
      };
      expect(StoreDefaultsSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects currencies other than 'try'", () => {
      const invalid = {
        ...STORE_DEFAULTS,
        store: {
          ...STORE_DEFAULTS.store,
          default_currency_code: "usd",
        },
      };
      expect(StoreDefaultsSchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects negative shipping amounts", () => {
      const invalid = {
        ...STORE_DEFAULTS,
        fulfillment: {
          ...STORE_DEFAULTS.fulfillment,
          shipping_options: [
            {
              name: "Negative Shipping",
              price_type: "flat" as const,
              amount: -10,
              min_subtotal: null,
            },
          ],
        },
      };
      expect(StoreDefaultsSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
