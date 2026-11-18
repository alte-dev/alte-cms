import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME_SETTINGS,
  buildThemeCssVariables,
  isValidHexColor,
  resolveThemeSettings,
} from "../lib/theme/css-vars";
import { ThemeSettings } from "../globals/ThemeSettings";

describe("ThemeSettings & Storefront CSS Variables (TDD)", () => {
  describe("isValidHexColor", () => {
    it("accepts 6-digit hex colors and rejects invalid or injection strings", () => {
      expect(isValidHexColor("#3A4A5B")).toBe(true);
      expect(isValidHexColor("#ffffff")).toBe(true);
      expect(isValidHexColor("#FFF")).toBe(false);
      expect(isValidHexColor("red; background: url(x)")).toBe(false);
      expect(isValidHexColor("javascript:alert(1)")).toBe(false);
      expect(isValidHexColor(null)).toBe(false);
    });
  });

  describe("resolveThemeSettings & buildThemeCssVariables", () => {
    it("uses #3A4A5B / #2E3B49 checkout palette as default when input is null", () => {
      const resolved = resolveThemeSettings(null);
      expect(resolved.primaryColor).toBe("#3A4A5B");
      expect(resolved.primaryHoverColor).toBe("#2E3B49");
      expect(resolved.checkoutSummaryBgColor).toBe("#F5F5F5");

      const vars = buildThemeCssVariables(resolved);
      expect(vars["--theme-primary"]).toBe("#3A4A5B");
      expect(vars["--theme-primary-hover"]).toBe("#2E3B49");
      expect(vars["--theme-checkout-summary-bg"]).toBe("#F5F5F5");
    });

    it("applies valid overrides and falls back safely on invalid hex values", () => {
      const resolved = resolveThemeSettings({
        primaryColor: "#1F2937",
        primaryHoverColor: "not-a-color",
        fontFamily: "serif",
        buttonRadius: "full",
        buttonTextTransform: "uppercase",
      });

      expect(resolved.primaryColor).toBe("#1F2937");
      expect(resolved.primaryHoverColor).toBe(DEFAULT_THEME_SETTINGS.primaryHoverColor);

      const vars = buildThemeCssVariables(resolved);
      expect(vars["--theme-primary"]).toBe("#1F2937");
      expect(vars["--theme-font-body"]).toContain("Georgia");
      expect(vars["--theme-button-radius"]).toBe("9999px");
      expect(vars["--theme-button-transform"]).toBe("uppercase");
    });
  });

  describe("Payload ThemeSettings Global Structure", () => {
    it("organizes theme options into separate tabs instead of a single flat list", () => {
      expect(ThemeSettings.slug).toBe("theme-settings");
      const tabsField = ThemeSettings.fields.find((f) => f.type === "tabs");
      expect(tabsField).toBeDefined();
      if (tabsField && tabsField.type === "tabs") {
        expect(tabsField.tabs.length).toBeGreaterThanOrEqual(4);
        const labels = tabsField.tabs.map((t) => t.label);
        expect(labels).toContain("Renk Paleti");
        expect(labels).toContain("Tipografi & Yazı Stili");
        expect(labels).toContain("Butonlar & Köşeler");
        expect(labels).toContain("Ödeme & Sepet");
      }
    });
  });
});
