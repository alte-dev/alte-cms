import { describe, it, expect, vi } from "vitest";
import {
  resolveChromiumLaunchOptions,
  planCartItemsToExceedThreshold,
  handleLiveServerAbsence,
} from "./helpers/live-browser";

describe("Live Browser & Dynamic Cart Helper (Faz 11.5 Section 0)", () => {
  it("builds Chromium launch options using CHROME_PATH when provided and Playwright default otherwise", () => {
    const withCustomPath = resolveChromiumLaunchOptions({ CHROME_PATH: "/custom/chrome" });
    expect(withCustomPath.headless).toBe(true);
    expect(withCustomPath.executablePath).toBe("/custom/chrome");
    expect(withCustomPath.args).toContain("--no-sandbox");

    const withDefault = resolveChromiumLaunchOptions({});
    expect(withDefault.headless).toBe(true);
    expect(withDefault.executablePath).toBeUndefined();
    expect(withDefault.args).toContain("--no-sandbox");
  });

  it("plans cart items to exceed free shipping threshold (1500 TL) dynamically even with 140 TL items or limited stock", () => {
    // Case 1: Single 140 TL product with plenty of stock -> 11 units = 1540 TL >= 1500 TL
    const planSingle = planCartItemsToExceedThreshold(
      [
        {
          id: "var_sabit_1",
          sku: "SKU-SABIT-1",
          unitPrice: 140,
          availableQuantity: 50,
        },
      ],
      1500,
    );
    const totalSingle = planSingle.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    expect(totalSingle).toBeGreaterThanOrEqual(1500);
    expect(planSingle[0]?.quantity).toBe(11);

    // Case 2: Multiple variants with limited stock, plus SERVICE-COD-FEE which must be ignored
    const planMulti = planCartItemsToExceedThreshold(
      [
        {
          id: "var_cod",
          sku: "SERVICE-COD-FEE",
          unitPrice: 100,
          availableQuantity: 999,
        },
        {
          id: "var_a",
          sku: "SKU-A",
          unitPrice: 400,
          availableQuantity: 2, // max 800 TL
        },
        {
          id: "var_b",
          sku: "SKU-B",
          unitPrice: 300,
          availableQuantity: 5, // needs 3 units = 900 TL -> 800 + 900 = 1700 TL >= 1500 TL
        },
      ],
      1500,
    );
    expect(planMulti.some((p) => p.variantId === "var_cod")).toBe(false);
    const totalMulti = planMulti.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    expect(totalMulti).toBeGreaterThanOrEqual(1500);
  });

  it("fails loudly when REQUIRE_LIVE_SERVER=true and skips cleanly when unset", () => {
    const skipSpy = vi.fn();
    handleLiveServerAbsence({ skip: skipSpy }, "Sunucu kapalı", { REQUIRE_LIVE_SERVER: "false" });
    expect(skipSpy).toHaveBeenCalledTimes(1);

    const skipSpy2 = vi.fn();
    expect(() =>
      handleLiveServerAbsence({ skip: skipSpy2 }, "Sunucu kapalı", {
        REQUIRE_LIVE_SERVER: "true",
      }),
    ).toThrow(/Sunucu kapalı/);
    expect(skipSpy2).not.toHaveBeenCalled();
  });
});
