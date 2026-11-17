import bcrypt from "bcryptjs";
import type { LegacyPasswordVerifier } from "./types";

/**
 * Plain bcrypt (`$2y$`, `$2a$`, `$2b$`) verifier.
 * Normalizes PHP `$2y$` prefix to `$2b$` for bcryptjs, which enforces the
 * same 72-byte UTF-8 truncation semantics as PHP `password_verify`.
 */
export const bcryptVerifier: LegacyPasswordVerifier = {
  algorithm: "bcrypt",
  async verify(password: string, legacyHash: string): Promise<boolean> {
    if (!password || !legacyHash) return false;
    if (!/^\$2[aby]\$\d{2}\$.{53}$/.test(legacyHash)) return false;

    const normalized = legacyHash.startsWith("$2y$") ? `$2b$${legacyHash.slice(4)}` : legacyHash;
    try {
      return await bcrypt.compare(password, normalized);
    } catch {
      return false;
    }
  },
};
