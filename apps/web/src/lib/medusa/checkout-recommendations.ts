import type { StoreCart, StoreProduct } from "./types";
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

export interface AddRecommendedResult {
  ok: boolean;
  cart: StoreCart | null;
  error: string | null;
}

export async function addRecommendedProductToCart(
  product: StoreProduct,
  selectedVariantId?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AddRecommendedResult> {
  const availableVariants = (product.variants || []).filter((v) => !isVariantOutOfStock(v));
  const chosenVariant =
    (selectedVariantId && availableVariants.find((v) => v.id === selectedVariantId)) ||
    availableVariants[0];

  if (!chosenVariant?.id) {
    return { ok: false, cart: null, error: "Bu ürün şu anda stokta yok." };
  }

  try {
    const res = await fetchImpl("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", variantId: chosenVariant.id, quantity: 1 }),
    });
    const data = (await res.json().catch(() => ({}))) as { cart?: StoreCart; error?: string };
    if (!res.ok || !data.cart) {
      return { ok: false, cart: null, error: data.error || "Ürün sepete eklenemedi." };
    }
    return { ok: true, cart: data.cart, error: null };
  } catch {
    return { ok: false, cart: null, error: "Ürün sepete eklenirken bir hata oluştu." };
  }
}
