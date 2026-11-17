import crypto from "crypto";
import type { LegacyPasswordVerifier } from "./types";

const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function encode64(input: Buffer, count: number): string {
  let output = "";
  let i = 0;
  do {
    let value = input[i++];
    output += ITOA64[value & 0x3f];
    if (i < count) {
      value |= input[i] << 8;
    }
    output += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) {
      value |= input[i] << 16;
    }
    output += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    output += ITOA64[(value >> 18) & 0x3f];
  } while (i < count);
  return output;
}

/**
 * Portable phpass (`$P$` and `$H$`) verifier.
 * Self-contained MD5 iteration implementation with constant-time comparison.
 */
export const phpassVerifier: LegacyPasswordVerifier = {
  algorithm: "phpass",
  async verify(password: string, legacyHash: string): Promise<boolean> {
    if (!password || !legacyHash) return false;
    if (legacyHash.length !== 34) return false;
    if (!legacyHash.startsWith("$P$") && !legacyHash.startsWith("$H$")) return false;

    const countLog2 = ITOA64.indexOf(legacyHash[3]);
    if (countLog2 < 7 || countLog2 > 30) return false;

    const count = 1 << countLog2;
    const salt = legacyHash.slice(4, 12);
    if (salt.length !== 8) return false;

    try {
      const pwBuf = Buffer.from(password, "utf8");
      let hash = crypto
        .createHash("md5")
        .update(Buffer.concat([Buffer.from(salt, "utf8"), pwBuf]))
        .digest();

      for (let i = 0; i < count; i++) {
        hash = crypto
          .createHash("md5")
          .update(Buffer.concat([hash, pwBuf]))
          .digest();
      }

      const candidate = legacyHash.slice(0, 12) + encode64(hash, 16);
      const a = Buffer.from(candidate, "utf8");
      const b = Buffer.from(legacyHash, "utf8");
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },
};
