import crypto from "crypto";
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { detectLegacyAlgorithm } from "./detect";
import { defaultLegacyVerifierRegistry } from "./registry";

describe("detectLegacyAlgorithm", () => {
  it("detects wp-bcrypt-sha384, bcrypt, phpass, and md5", () => {
    expect(
      detectLegacyAlgorithm("$wp$2y$10$abcdefghijklmnopqrstuv1234567890123456789012345678901"),
    ).toBe("wp-bcrypt-sha384");
    expect(
      detectLegacyAlgorithm("$2y$10$abcdefghijklmnopqrstuv1234567890123456789012345678901"),
    ).toBe("bcrypt");
    expect(
      detectLegacyAlgorithm("$2a$10$abcdefghijklmnopqrstuv1234567890123456789012345678901"),
    ).toBe("bcrypt");
    expect(
      detectLegacyAlgorithm("$2b$10$abcdefghijklmnopqrstuv1234567890123456789012345678901"),
    ).toBe("bcrypt");
    expect(detectLegacyAlgorithm("$P$B123456789012345678901234567890")).toBe("phpass");
    expect(detectLegacyAlgorithm("$H$9123456789012345678901234567890")).toBe("phpass");
    expect(detectLegacyAlgorithm("5d41402abc4b2a76b9719d911017c592")).toBe("md5");
    expect(detectLegacyAlgorithm("5D41402ABC4B2A76B9719D911017C592")).toBe("md5");
  });

  it("returns null for empty, oversized, NUL-containing, or unknown hashes", () => {
    expect(detectLegacyAlgorithm("")).toBeNull();
    expect(detectLegacyAlgorithm("   ")).toBeNull();
    expect(detectLegacyAlgorithm("a".repeat(256))).toBeNull();
    expect(detectLegacyAlgorithm("$2y$10$abc\0def")).toBeNull();
    expect(detectLegacyAlgorithm("$argon2id$v=19$m=65536,t=3,p=1$abc$def")).toBeNull();
    expect(detectLegacyAlgorithm("not-a-valid-hash")).toBeNull();
  });
});

describe("defaultLegacyVerifierRegistry production verifiers", () => {
  it("registers all 4 production verifiers", () => {
    expect(defaultLegacyVerifierRegistry.has("wp-bcrypt-sha384")).toBe(true);
    expect(defaultLegacyVerifierRegistry.has("bcrypt")).toBe(true);
    expect(defaultLegacyVerifierRegistry.has("phpass")).toBe(true);
    expect(defaultLegacyVerifierRegistry.has("md5")).toBe(true);
  });

  it("verifies wp-bcrypt-sha384 including >72 bytes and Turkish characters", async () => {
    const makeWpHash = async (pw: string) => {
      const prehash = crypto.createHmac("sha384", "wp-sha384").update(pw, "utf8").digest("base64");
      const bHash = await bcrypt.hash(prehash, 4);
      // Simulate PHP $2y$ prefix
      return "$wp" + bHash.replace(/^\$2b\$/, "$2y$");
    };

    const normalPw = "TestPass-2026!";
    const normalHash = await makeWpHash(normalPw);
    expect(
      await defaultLegacyVerifierRegistry.verify("wp-bcrypt-sha384", normalPw, normalHash),
    ).toBe(true);
    expect(
      await defaultLegacyVerifierRegistry.verify("wp-bcrypt-sha384", "WrongPass", normalHash),
    ).toBe(false);

    // >72 byte password must NOT truncate at 72 bytes (unlike plain bcrypt)
    const longPrefix = "A".repeat(75);
    const longPw1 = longPrefix + "_one";
    const longPw2 = longPrefix + "_two";
    const longHash1 = await makeWpHash(longPw1);
    expect(await defaultLegacyVerifierRegistry.verify("wp-bcrypt-sha384", longPw1, longHash1)).toBe(
      true,
    );
    expect(await defaultLegacyVerifierRegistry.verify("wp-bcrypt-sha384", longPw2, longHash1)).toBe(
      false,
    );

    // Turkish characters
    const trPw = "İşçi-Şifre-ğüö-2026";
    const trHash = await makeWpHash(trPw);
    expect(await defaultLegacyVerifierRegistry.verify("wp-bcrypt-sha384", trPw, trHash)).toBe(true);

    // >4096 bytes rejected per WP wp_check_password
    expect(
      await defaultLegacyVerifierRegistry.verify("wp-bcrypt-sha384", "x".repeat(4097), normalHash),
    ).toBe(false);

    // Empty / malformed fail-closed
    expect(await defaultLegacyVerifierRegistry.verify("wp-bcrypt-sha384", "", normalHash)).toBe(
      false,
    );
    expect(
      await defaultLegacyVerifierRegistry.verify("wp-bcrypt-sha384", normalPw, "$wp$invalid"),
    ).toBe(false);
  });

  it("verifies plain bcrypt ($2y$, $2a$, $2b$) and preserves 72-byte behavior", async () => {
    // Real $2y$ vector generated with PHP password_hash('İşçi-Şifre-ğüö', PASSWORD_BCRYPT, ['cost' => 4]) equivalent:
    // Using bcryptjs $2b$ converted to $2y$ to explicitly test $2y$ -> $2b$ conversion
    const trPw = "İşçi-Şifre-ğüö";
    const hash2b = await bcrypt.hash(trPw, 4);
    const hash2y = hash2b.replace(/^\$2b\$/, "$2y$");
    expect(hash2y.startsWith("$2y$")).toBe(true);
    expect(await defaultLegacyVerifierRegistry.verify("bcrypt", trPw, hash2y)).toBe(true);
    expect(await defaultLegacyVerifierRegistry.verify("bcrypt", "wrong", hash2y)).toBe(false);

    // 72-byte truncation parity with PHP bcrypt
    const p72 = "B".repeat(72);
    const h72 = (await bcrypt.hash(p72 + "_tail1", 4)).replace(/^\$2b\$/, "$2y$");
    expect(await defaultLegacyVerifierRegistry.verify("bcrypt", p72 + "_tail2", h72)).toBe(true);

    // $2a$
    const hash2a = hash2b.replace(/^\$2b\$/, "$2a$");
    expect(await defaultLegacyVerifierRegistry.verify("bcrypt", trPw, hash2a)).toBe(true);
  });

  it("verifies phpass ($P$ and $H$) using public test vectors", async () => {
    // Standard public phpass vector: password "test12345" -> "$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0"
    expect(
      await defaultLegacyVerifierRegistry.verify(
        "phpass",
        "test12345",
        "$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0",
      ),
    ).toBe(true);
    expect(
      await defaultLegacyVerifierRegistry.verify(
        "phpass",
        "wrongpass",
        "$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0",
      ),
    ).toBe(false);

    // $H$ variant (same algorithm as $P$)
    expect(
      await defaultLegacyVerifierRegistry.verify(
        "phpass",
        "test12345",
        "$H$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0",
      ),
    ).toBe(true);

    // Malformed / short / empty
    expect(
      await defaultLegacyVerifierRegistry.verify(
        "phpass",
        "",
        "$P$9IQRaTwmfeRo7ud9Fh4E2PdI0S3r.L0",
      ),
    ).toBe(false);
    expect(await defaultLegacyVerifierRegistry.verify("phpass", "test12345", "$P$short")).toBe(
      false,
    );
  });

  it("verifies legacy 32-char md5 hashes (verify-only, constant-time)", async () => {
    const pw = "İşçi-Şifre-ğüö";
    const md5Hex = crypto.createHash("md5").update(pw, "utf8").digest("hex");
    expect(await defaultLegacyVerifierRegistry.verify("md5", pw, md5Hex)).toBe(true);
    expect(await defaultLegacyVerifierRegistry.verify("md5", pw, md5Hex.toUpperCase())).toBe(true);
    expect(await defaultLegacyVerifierRegistry.verify("md5", "wrong", md5Hex)).toBe(false);
    expect(await defaultLegacyVerifierRegistry.verify("md5", "", md5Hex)).toBe(false);
    expect(await defaultLegacyVerifierRegistry.verify("md5", pw, "not-md5")).toBe(false);
  });
});
