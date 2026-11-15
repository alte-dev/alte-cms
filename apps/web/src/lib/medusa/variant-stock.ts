import type { StoreProductOption, StoreProductVariant } from "./types";

/**
 * Returns true if the variant has inventory tracking enabled, backorders disabled,
 * and zero (or negative) available inventory.
 */
export function isVariantOutOfStock(variant: StoreProductVariant | undefined): boolean {
  if (!variant) return true;
  return Boolean(
    variant.manage_inventory &&
      !variant.allow_backorder &&
      variant.inventory_quantity !== undefined &&
      variant.inventory_quantity <= 0,
  );
}

function variantToOptionMap(variant: StoreProductVariant | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!variant?.options) return map;
  for (const opt of variant.options) {
    map[opt.option_id] = opt.value;
  }
  return map;
}

function variantHasOption(variant: StoreProductVariant, optionId: string, value: string): boolean {
  return Boolean(variant.options?.some((o) => o.option_id === optionId && o.value === value));
}

function variantMatchesSelection(
  variant: StoreProductVariant,
  selection: Record<string, string>,
): boolean {
  if (!variant.options || variant.options.length === 0) return true;
  return variant.options.every((opt) => selection[opt.option_id] === opt.value);
}

/**
 * Picks the initial option selection from the first in-stock variant,
 * falling back to variants[0] when all variants are out of stock.
 */
export function getInitialSelectedOptions(variants: StoreProductVariant[]): Record<string, string> {
  const preferred = variants.find((v) => !isVariantOutOfStock(v)) ?? variants[0];
  return variantToOptionMap(preferred);
}

/**
 * Determines whether an option value should be selectable.
 * - Primary option (index 0): selectable if at least one in-stock variant has this value.
 * - Subsequent options: selectable if at least one in-stock variant has this value AND
 *   matches all preceding selected options (or if no preceding options exist).
 */
export function isOptionValueSelectable(
  variants: StoreProductVariant[],
  options: StoreProductOption[],
  selectedOptions: Record<string, string>,
  optionIndex: number,
  optionId: string,
  value: string,
): boolean {
  const precedingOptions = options.slice(0, optionIndex);

  return variants.some((variant) => {
    if (isVariantOutOfStock(variant)) return false;
    if (!variantHasOption(variant, optionId, value)) return false;

    return precedingOptions.every((prevOpt) => {
      const selectedVal = selectedOptions[prevOpt.id];
      return !selectedVal || variantHasOption(variant, prevOpt.id, selectedVal);
    });
  });
}

/**
 * Resolves the next option selection when the user clicks an option value.
 * If the exact combination with other currently selected options is out of stock,
 * automatically switches to the first in-stock variant that has the clicked option value.
 */
export function resolveOptionsOnChange(
  variants: StoreProductVariant[],
  currentSelection: Record<string, string>,
  optionId: string,
  value: string,
): Record<string, string> {
  const candidate = { ...currentSelection, [optionId]: value };
  const exactVariant = variants.find((v) => variantMatchesSelection(v, candidate));
  if (exactVariant && !isVariantOutOfStock(exactVariant)) {
    return candidate;
  }

  const fallbackInStock = variants.find(
    (v) => variantHasOption(v, optionId, value) && !isVariantOutOfStock(v),
  );
  if (fallbackInStock) {
    return variantToOptionMap(fallbackInStock);
  }

  return candidate;
}
