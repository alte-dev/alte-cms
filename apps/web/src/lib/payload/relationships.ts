import type { Media, User, PostCategory } from "@/payload-types";

/**
 * Type guard to check if a relation field is a populated Media object.
 */
export function isPopulatedMedia(media: unknown): media is Media {
  return (
    typeof media === "object" &&
    media !== null &&
    "url" in media &&
    typeof (media as Media).url === "string"
  );
}

/**
 * Type guard to check if an author field is a populated User object.
 */
export function isPopulatedUser(user: unknown): user is User {
  return typeof user === "object" && user !== null && "id" in user;
}

/**
 * Type guard to check if a category field is a populated PostCategory object.
 */
export function isPopulatedCategory(cat: unknown): cat is PostCategory {
  return (
    typeof cat === "object" &&
    cat !== null &&
    "slug" in cat &&
    "title" in cat &&
    typeof (cat as PostCategory).slug === "string"
  );
}

/**
 * Extracts all populated categories from a categories relationship array.
 */
export function getPopulatedCategories(
  categories: (number | PostCategory)[] | null | undefined,
): PostCategory[] {
  if (!Array.isArray(categories)) return [];
  return categories.filter(isPopulatedCategory);
}
