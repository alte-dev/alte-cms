import { revalidateTag } from "next/cache";

export const CACHE_TAGS = {
  products: "products",
  product: (handle: string) => `product-${handle}`,
  categories: "categories",
  category: (handle: string) => `category-${handle}`,
  blog: "blog",
  post: (slug: string) => `post-${slug}`,
  pages: "pages",
  page: (slug: string) => `page-${slug}`,
  navigation: "navigation",
  settings: "site-settings",
} as const;

/**
 * Invalidates a Next.js cache tag.
 * Re-throws unexpected errors so callers can handle them appropriately.
 * Ignores missing static generation store when running in standalone CLI/seed scripts.
 */
export function revalidateContentTag(tag: string): void {
  try {
    revalidateTag(tag);
  } catch (err: any) {
    if (err?.message?.includes("static generation store missing")) {
      // Expected when executing inside standalone scripts or Payload CLI outside Next.js request store
      return;
    }
    console.error(`[Cache] revalidateTag failed for tag: ${tag}`, (err as Error).name);
    throw err;
  }
}
