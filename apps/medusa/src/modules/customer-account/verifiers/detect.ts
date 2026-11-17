export type LegacyAlgorithm = "wp-bcrypt-sha384" | "bcrypt" | "phpass" | "md5";

const MAX_HASH_LENGTH = 255;

/**
 * Detects the legacy password hash algorithm from its prefix/format.
 * Pure function; returns null for empty, oversized, NUL-containing, or unknown hashes.
 */
export function detectLegacyAlgorithm(hash: string): LegacyAlgorithm | null {
  if (typeof hash !== "string") return null;
  if (hash.includes("\0")) return null;
  const trimmed = hash.trim();
  if (!trimmed || trimmed.length > MAX_HASH_LENGTH) return null;

  if (/^\$wp\$2[aby]\$\d{2}\$.{53}$/.test(trimmed)) {
    return "wp-bcrypt-sha384";
  }
  if (/^\$2[aby]\$\d{2}\$.{53}$/.test(trimmed)) {
    return "bcrypt";
  }
  if (/^\$[PH]\$[./0-9A-Za-z]{31}$/.test(trimmed)) {
    return "phpass";
  }
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return "md5";
  }

  return null;
}
