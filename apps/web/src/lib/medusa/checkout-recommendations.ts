import type { StoreProduct } from "./types";
import { isVariantOutOfStock } from "./variant-stock";

export interface CheckoutRecommendationOptions {
  products: StoreProduct[];
  cartProductIds: Set<string>;
  source: "bestsellers" | "manual";
  manualHandles?: string | null;
  limit?: number;
}

function hasPurchasableVariant(product: StoreProduct): boolean {
  const variants = product.variants || [];
  return variants.some((v) => !isVariantOutOfStock(v));
}

export function selectCheckoutRecommendations({
  products,
  cartProductIds,
  source,
  manualHandles,
  limit = 3,
}: CheckoutRecommendationOptions): StoreProduct[] {
  const safeLimit = Math.max(1, Math.min(4, Math.floor(Number(limit) || 3)));
  const eligible = products.filter((p) => !cartProductIds.has(p.id) && hasPurchasableVariant(p));

  if (source === "manual") {
    const wantedHandles = (manualHandles || "")
      .split(/[\s,]+/)
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    if (wantedHandles.length === 0) return [];

    const byHandle = new Map(eligible.map((p) => [p.handle.toLowerCase(), p]));
    const ordered: StoreProduct[] = [];
    for (const handle of wantedHandles) {
      const found = byHandle.get(handle);
      if (found && !ordered.some((o) => o.id === found.id)) {
        ordered.push(found);
        if (ordered.length >= safeLimit) break;
      }
    }
    return ordered;
  }

  return eligible.slice(0, safeLimit);
}
