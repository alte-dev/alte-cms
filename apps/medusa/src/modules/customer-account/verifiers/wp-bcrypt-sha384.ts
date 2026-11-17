import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { LegacyPasswordVerifier } from "./types";

const MAX_WP_PASSWORD_BYTES = 4096;

/**
 * WordPress 6.8+ / 7.x `$wp$2y$...` verifier.
 * Verified against WordPress/wordpress-develop `src/wp-includes/pluggable.php`
 * (`wp_check_password` lines 2868-2875):
 *   - Rejects passwords > 4096 bytes.
 *   - Pre-hashes raw password (no trim) with HMAC-SHA384 key "wp-sha384", base64-encoded.
 *   - Strips `$wp` prefix and verifies against `$2y$` (normalized to `$2b$` for bcryptjs).
 */
export const wpBcryptSha384Verifier: LegacyPasswordVerifier = {
  algorithm: "wp-bcrypt-sha384",
  async verify(password: string, legacyHash: string): Promise<boolean> {
    if (!password || !legacyHash) return false;
    if (Buffer.byteLength(password, "utf8") > MAX_WP_PASSWORD_BYTES) return false;
    if (!legacyHash.startsWith("$wp")) return false;

    const inner = legacyHash.slice(3);
    if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(inner)) return false;

    const normalizedInner = inner.startsWith("$2y$") ? `$2b$${inner.slice(4)}` : inner;
    try {
      const prehash = crypto
        .createHmac("sha384", "wp-sha384")
        .update(password, "utf8")
        .digest("base64");
      return await bcrypt.compare(prehash, normalizedInner);
    } catch {
      return false;
    }
  },
};
