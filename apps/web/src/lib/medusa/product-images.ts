import { isSafeHref } from "../safe-href";
import type { StoreProduct } from "./types";

export interface ProductGalleryImage {
  id: string;
  url: string;
}

/**
 * Validates that an image URL is either a safe relative path (/...) or https:// URL
 * (plus http://localhost or http://127.0.0.1 in non-production environments).
 */
export function resolveSafeImageUrl(raw?: string | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isSafeHref(trimmed)) return trimmed;
  if (
    process.env.NODE_ENV !== "production" &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

/**
 * Returns the primary safe image URL for a product card (thumbnail first, then first gallery image).
 */
export function resolveProductCardImage(
  product: Pick<StoreProduct, "thumbnail" | "images">,
): string | null {
  const fromThumb = resolveSafeImageUrl(product.thumbnail);
  if (fromThumb) return fromThumb;

  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      const safe = resolveSafeImageUrl(img?.url);
      if (safe) return safe;
    }
  }
  return null;
}

/**
 * Builds a deduplicated, safe gallery image list (thumbnail first, then unique product.images).
 */
export function resolveProductGalleryImages(
  product: Pick<StoreProduct, "thumbnail" | "images">,
): ProductGalleryImage[] {
  const seen = new Set<string>();
  const result: ProductGalleryImage[] = [];

  const thumb = resolveSafeImageUrl(product.thumbnail);
  if (thumb) {
    seen.add(thumb);
    result.push({ id: "thumbnail", url: thumb });
  }

  if (Array.isArray(product.images)) {
    product.images.forEach((img, index) => {
      const safe = resolveSafeImageUrl(img?.url);
      if (safe && !seen.has(safe)) {
        seen.add(safe);
        result.push({ id: img.id || `image-${index}`, url: safe });
      }
    });
  }

  return result;
}
