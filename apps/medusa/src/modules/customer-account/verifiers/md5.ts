import crypto from "crypto";
import type { LegacyPasswordVerifier } from "./types";

/**
 * Legacy 32-character hex MD5 verifier (verify-only, never generates new hashes).
 * Uses constant-time comparison.
 */
export const md5Verifier: LegacyPasswordVerifier = {
  algorithm: "md5",
  async verify(password: string, legacyHash: string): Promise<boolean> {
    if (!password || !legacyHash) return false;
    if (!/^[a-f0-9]{32}$/i.test(legacyHash)) return false;

    try {
      const actual = crypto.createHash("md5").update(password, "utf8").digest("hex");
      return crypto.timingSafeEqual(
        Buffer.from(actual, "ascii"),
        Buffer.from(legacyHash.toLowerCase(), "ascii"),
      );
    } catch {
      return false;
    }
  },
};
