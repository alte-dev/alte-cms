/**
 * Slugify utility with robust Turkish character conversion and reserved slug validation.
 */

export const RESERVED_SLUGS = [
  "admin",
  "api",
  "blog",
  "kategori",
  "urun",
  "urunler",
  "sepet",
  "odeme",
  "siparis-onay",
  "sayfa",
  "onizleme",
  "media",
  "sitemap",
  "sitemap.xml",
  "robots",
  "robots.txt",
  "login",
  "logout",
  "search",
  "arama",
  "hesap",
  "checkout",
  "cart",
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

const TURKISH_CHAR_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  i: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

/**
 * Converts any title or text into a clean, lowercase URL-safe slug,
 * properly transliterating Turkish characters.
 */
export function slugify(text: string): string {
  if (!text || typeof text !== "string") return "";

  // 1. Transliterate Turkish characters first
  let result = text.replace(/[çÇğĞıIİiöÖşŞüÜ]/g, (char) => TURKISH_CHAR_MAP[char] || char);

  // 2. Normalize unicode diacritics and remove them
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 3. Lowercase and replace non-alphanumeric chars with hyphen
  result = result
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, ""); // Trim leading and trailing hyphens

  return result;
}

/**
 * Checks whether a given slug is reserved by the system.
 */
export function isReservedSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") return false;
  const clean = slug
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "");
  return RESERVED_SLUGS.includes(clean as ReservedSlug);
}

/**
 * Payload field validation hook for slug fields.
 */
export function validateSlugField(
  val: unknown,
  { t }: { t?: (key: string) => string } = {},
): true | string {
  if (!val || typeof val !== "string") {
    return "Slug alanı zorunludur.";
  }

  const clean = val.trim();
  if (clean.length === 0) {
    return "Slug boş olamaz.";
  }

  if (isReservedSlug(clean)) {
    return `'${clean}' sistem tarafından rezerve edilmiş bir rota adıdır ve slug olarak kullanılamaz.`;
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) {
    return "Slug yalnızca küçük harf, rakam ve tire (-) içerebilir, tire ile başlayıp bitemez.";
  }

  return true;
}
