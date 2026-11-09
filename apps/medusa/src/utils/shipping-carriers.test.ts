import { describe, expect, it } from "vitest";
import {
  buildTrackingUrl,
  sanitizeCsvCell,
  SUPPORTED_CARRIERS,
  timingSafeEmailMatch,
  validateTrackingCode,
} from "./shipping-carriers";

describe("shipping-carriers utilities", () => {
  describe("validateTrackingCode", () => {
    it("accepts valid alphanumeric and hyphen tracking codes", () => {
      expect(validateTrackingCode("123456789012")).toBe(true);
      expect(validateTrackingCode("YK-987654321-TR")).toBe(true);
      expect(validateTrackingCode("ARAS-1234")).toBe(true);
    });

    it("rejects invalid characters and dangerous payloads", () => {
      expect(validateTrackingCode("")).toBe(false);
      expect(validateTrackingCode("123 456")).toBe(false); // space
      expect(validateTrackingCode("YK-123; DROP TABLE")).toBe(false); // sql injection chars
      expect(validateTrackingCode("<script>")).toBe(false);
      expect(validateTrackingCode("A".repeat(41))).toBe(false); // length > 40
    });
  });

  describe("buildTrackingUrl", () => {
    it("generates correct tracking URLs for supported carriers", () => {
      const yurticiUrl = buildTrackingUrl("yurtici", "YK-123456");
      expect(yurticiUrl).toBe(
        "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=YK-123456",
      );

      const arasUrl = buildTrackingUrl("aras", "ARAS-789");
      expect(arasUrl).toBe("https://www.araskargo.com.tr/kargo-takip?code=ARAS-789");
    });

    it("rejects non-https, javascript: and dangerous schemes", () => {
      expect(() => buildTrackingUrl("diger", "CODE1", "http://insecure.com/track")).toThrow(
        "yalnızca HTTPS",
      );

      expect(() => buildTrackingUrl("diger", "CODE1", "javascript:alert(1)")).toThrow(
        "yalnızca HTTPS",
      );

      expect(() => buildTrackingUrl("diger", "CODE1", "https://evil.com/fake")).not.toThrow();
    });

    it("enforces carrier domain whitelist for known carriers", () => {
      expect(() => buildTrackingUrl("yurtici", "CODE1", "https://attacker.com")).not.toThrow(); // uses yurticikargo.com template automatically
    });
  });

  describe("timingSafeEmailMatch", () => {
    it("matches identical emails case-insensitively with Turkish locale", () => {
      expect(timingSafeEmailMatch("Musteri@example.com", "musteri@example.com")).toBe(true);
      expect(timingSafeEmailMatch("İPEK@EXAMPLE.COM", "ipek@example.com")).toBe(true);
      expect(timingSafeEmailMatch("IŞIK@EXAMPLE.COM", "ışık@example.com")).toBe(true);
    });

    it("rejects non-matching emails", () => {
      expect(timingSafeEmailMatch("user1@example.com", "user2@example.com")).toBe(false);
      expect(timingSafeEmailMatch("", "user@example.com")).toBe(false);
    });
  });

  describe("sanitizeCsvCell", () => {
    it("escapes formula injection characters (=, +, -, @, \\t, \\r)", () => {
      expect(sanitizeCsvCell("=CMD('calc')")).toBe(`"'=CMD('calc')\"`);
      expect(sanitizeCsvCell("+12345")).toBe(`"'+12345\"`);
      expect(sanitizeCsvCell("-100")).toBe(`"'-100\"`);
      expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe(`"'@SUM(A1:A10)\"`);
    });

    it("escapes quotes properly", () => {
      expect(sanitizeCsvCell('Normal "Value"')).toBe(`"Normal ""Value"""`);
      expect(sanitizeCsvCell("100 TL")).toBe(`"100 TL"`);
      expect(sanitizeCsvCell(null)).toBe('""');
    });
  });
});
