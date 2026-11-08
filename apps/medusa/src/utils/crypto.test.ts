import { describe, expect, it } from "vitest";
import {
  constantTimeCompare,
  decryptSetting,
  encryptSetting,
  maskSecret,
  parseEncryptionKey,
} from "./crypto";

describe("Settings Encryption & Crypto Utilities", () => {
  const validHexKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const validKeyBuf = parseEncryptionKey(validHexKey);

  it("successfully parses valid 32-byte hex key", () => {
    expect(validKeyBuf).toHaveLength(32);
  });

  it("rejects missing, short or weak keys fail-closed", () => {
    expect(() => parseEncryptionKey(undefined)).toThrow();
    expect(() => parseEncryptionKey("")).toThrow();
    expect(() => parseEncryptionKey("short-key")).toThrow();
    expect(() => parseEncryptionKey("12345678901234567890123456789012")).toThrow();
    expect(() =>
      parseEncryptionKey("0000000000000000000000000000000000000000000000000000000000000000"),
    ).toThrow();
  });

  it("encrypts and decrypts round-trip with AES-256-GCM", () => {
    const plainText = "secret-merchant-key-xyz-789";
    const cipherText = encryptSetting(plainText, validKeyBuf);

    expect(cipherText).not.toEqual(plainText);
    expect(cipherText.split(":")).toHaveLength(3);

    const decrypted = decryptSetting(cipherText, validKeyBuf);
    expect(decrypted).toEqual(plainText);
  });

  it("rejects tampered ciphertext fail-closed", () => {
    const plainText = "confidential-token";
    const cipherText = encryptSetting(plainText, validKeyBuf);
    const parts = cipherText.split(":");
    // Tamper the ciphertext data
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}ff`;

    expect(() => decryptSetting(tampered, validKeyBuf)).toThrow();
  });

  it("rejects wrong decryption key fail-closed", () => {
    const plainText = "confidential-token";
    const cipherText = encryptSetting(plainText, validKeyBuf);
    const anotherHexKey = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
    const anotherKeyBuf = parseEncryptionKey(anotherHexKey);

    expect(() => decryptSetting(cipherText, anotherKeyBuf)).toThrow();
  });

  it("masks secret showing only last 4 characters", () => {
    expect(maskSecret("")).toEqual("");
    expect(maskSecret("123")).toEqual("••••");
    expect(maskSecret("merchantKey1234")).toEqual("•••••••••••1234");
  });

  it("performs constant-time string comparison", () => {
    expect(constantTimeCompare("hashA", "hashA")).toBe(true);
    expect(constantTimeCompare("hashA", "hashB")).toBe(false);
    expect(constantTimeCompare("hashA", "hashLonger")).toBe(false);
  });
});
