import { describe, expect, it } from "vitest";
import type { StoreProductOption, StoreProductVariant } from "./types";
import {
  getInitialSelectedOptions,
  isOptionValueSelectable,
  isVariantOutOfStock,
  resolveOptionsOnChange,
} from "./variant-stock";

function makeVariant(
  id: string,
  opts: Record<string, string>,
  stock: { manage_inventory?: boolean; allow_backorder?: boolean; inventory_quantity?: number },
): StoreProductVariant {
  return {
    id,
    title: id,
    sku: id,
    manage_inventory: stock.manage_inventory ?? true,
    allow_backorder: stock.allow_backorder ?? false,
    inventory_quantity: stock.inventory_quantity,
    options: Object.entries(opts).map(([option_id, value], idx) => ({
      id: `${id}_opt_${idx}`,
      option_id,
      value,
    })),
  };
}

describe("variant stock helpers", () => {
  it("isVariantOutOfStock respects manage_inventory, allow_backorder, and inventory_quantity", () => {
    expect(isVariantOutOfStock(undefined)).toBe(true);
    expect(
      isVariantOutOfStock(
        makeVariant(
          "v1",
          {},
          { manage_inventory: true, allow_backorder: false, inventory_quantity: 0 },
        ),
      ),
    ).toBe(true);
    expect(
      isVariantOutOfStock(
        makeVariant(
          "v2",
          {},
          { manage_inventory: true, allow_backorder: true, inventory_quantity: 0 },
        ),
      ),
    ).toBe(false);
    expect(
      isVariantOutOfStock(
        makeVariant(
          "v3",
          {},
          { manage_inventory: false, allow_backorder: false, inventory_quantity: 0 },
        ),
      ),
    ).toBe(false);
    expect(
      isVariantOutOfStock(
        makeVariant(
          "v4",
          {},
          { manage_inventory: true, allow_backorder: false, inventory_quantity: 5 },
        ),
      ),
    ).toBe(false);
  });

  it("getInitialSelectedOptions picks the first in-stock variant when variants[0] is out of stock", () => {
    const variants = [
      makeVariant("v_s", { opt_size: "S" }, { inventory_quantity: 0 }),
      makeVariant("v_m", { opt_size: "M" }, { inventory_quantity: 3 }),
    ];
    expect(getInitialSelectedOptions(variants)).toEqual({ opt_size: "M" });

    // Falls back to variants[0] if all are out of stock
    const allEmpty = [
      makeVariant("v_s", { opt_size: "S" }, { inventory_quantity: 0 }),
      makeVariant("v_m", { opt_size: "M" }, { inventory_quantity: 0 }),
    ];
    expect(getInitialSelectedOptions(allEmpty)).toEqual({ opt_size: "S" });
  });

  it("disables out-of-stock single and multi-option values accurately without trapping user", () => {
    const options: StoreProductOption[] = [
      {
        id: "opt_size",
        title: "Beden",
        values: [
          { id: "s", value: "S" },
          { id: "m", value: "M" },
        ],
      },
      {
        id: "opt_color",
        title: "Renk",
        values: [
          { id: "black", value: "Siyah" },
          { id: "blue", value: "Mavi" },
        ],
      },
    ];

    // S+Siyah: 0, S+Mavi: 2, M+Siyah: 0, M+Mavi: 0
    const variants = [
      makeVariant("v1", { opt_size: "S", opt_color: "Siyah" }, { inventory_quantity: 0 }),
      makeVariant("v2", { opt_size: "S", opt_color: "Mavi" }, { inventory_quantity: 2 }),
      makeVariant("v3", { opt_size: "M", opt_color: "Siyah" }, { inventory_quantity: 0 }),
      makeVariant("v4", { opt_size: "M", opt_color: "Mavi" }, { inventory_quantity: 0 }),
    ];

    const selected = { opt_size: "S", opt_color: "Mavi" };
    // Primary option: S has stock (S+Mavi=2), M has 0 stock anywhere -> M disabled
    expect(isOptionValueSelectable(variants, options, selected, 0, "opt_size", "S")).toBe(true);
    expect(isOptionValueSelectable(variants, options, selected, 0, "opt_size", "M")).toBe(false);
    // Secondary option: for S, Siyah=0 -> disabled, Mavi=2 -> enabled
    expect(isOptionValueSelectable(variants, options, selected, 1, "opt_color", "Siyah")).toBe(
      false,
    );
    expect(isOptionValueSelectable(variants, options, selected, 1, "opt_color", "Mavi")).toBe(true);
  });

  it("resolveOptionsOnChange auto-switches secondary option to an in-stock variant when primary changes", () => {
    // S+Siyah=2, S+Mavi=0, M+Siyah=0, M+Mavi=3
    const variants = [
      makeVariant("v1", { opt_size: "S", opt_color: "Siyah" }, { inventory_quantity: 2 }),
      makeVariant("v2", { opt_size: "S", opt_color: "Mavi" }, { inventory_quantity: 0 }),
      makeVariant("v3", { opt_size: "M", opt_color: "Siyah" }, { inventory_quantity: 0 }),
      makeVariant("v4", { opt_size: "M", opt_color: "Mavi" }, { inventory_quantity: 3 }),
    ];

    // Currently S+Siyah, user clicks M (M+Siyah is 0, M+Mavi is 3) -> should auto-select M+Mavi
    expect(
      resolveOptionsOnChange(variants, { opt_size: "S", opt_color: "Siyah" }, "opt_size", "M"),
    ).toEqual({
      opt_size: "M",
      opt_color: "Mavi",
    });
  });
});
