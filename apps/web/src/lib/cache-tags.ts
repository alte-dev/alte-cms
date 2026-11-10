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
 * Safely invalidates a Next.js cache tag.
 * Catches errors if called outside an active Next.js request context (e.g., in Payload CLI or scripts).
 */
export function revalidateContentTag(tag: string): boolean {
  try {
    revalidateTag(tag);
    return true;
  } catch {
    return false;
  }
}
