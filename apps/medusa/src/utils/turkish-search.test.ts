import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeTurkishText,
  escapeLikeWildcards,
  validateSearchQuery,
  checkSearchRateLimit,
  resetSearchRateLimiter,
} from "./turkish-search";

describe("Turkish Search Utilities", () => {
  describe("Turkish Character Normalization", () => {
    it("normalizes Işık, ışık, and isik to identical string", () => {
      const a = normalizeTurkishText("Işık");
      const b = normalizeTurkishText("ışık");
      const c = normalizeTurkishText("isik");

      expect(a).toBe("isik");
      expect(b).toBe("isik");
      expect(c).toBe("isik");
      expect(a).toBe(b);
      expect(b).toBe(c);
    });

    it("normalizes İpek and ipek to identical string", () => {
      const a = normalizeTurkishText("İpek");
      const b = normalizeTurkishText("ipek");

      expect(a).toBe("ipek");
      expect(b).toBe("ipek");
      expect(a).toBe(b);
    });

    it("handles complex Turkish characters ç, ğ, ö, ş, ü", () => {
      expect(normalizeTurkishText("Çanta")).toBe("canta");
      expect(normalizeTurkishText("Gömlek")).toBe("gomlek");
      expect(normalizeTurkishText("Şapka")).toBe("sapka");
      expect(normalizeTurkishText("Düğme")).toBe("dugme");
      expect(normalizeTurkishText("Ağaç")).toBe("agac");
    });
  });

  describe("LIKE Wildcard Escaping", () => {
    it("escapes % and _ properly", () => {
      expect(escapeLikeWildcards("100% Cotton")).toBe("100\\% Cotton");
      expect(escapeLikeWildcards("test_sku")).toBe("test\\_sku");
      expect(escapeLikeWildcards("path\\test")).toBe("path\\\\test");
      expect(escapeLikeWildcards("normal text")).toBe("normal text");
    });
  });

  describe("Query Validation", () => {
    it("accepts valid query string between 2 and 100 characters", () => {
      const res = validateSearchQuery("elbise");
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe("elbise");
    });

    it("rejects query with fewer than 2 characters", () => {
      const res = validateSearchQuery("a");
      expect(res.valid).toBe(false);
      expect(res.error).toContain("en az 2 karakter");
    });

    it("rejects query with more than 100 characters", () => {
      const longQuery = "a".repeat(101);
      const res = validateSearchQuery(longQuery);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("en fazla 100 karakter");
    });

    it("rejects non-string queries", () => {
      expect(validateSearchQuery(null).valid).toBe(false);
      expect(validateSearchQuery(undefined).valid).toBe(false);
      expect(validateSearchQuery(123).valid).toBe(false);
    });

    it("strips control characters", () => {
      const res = validateSearchQuery("elbise\x00\x1F");
      expect(res.valid).toBe(true);
      expect(res.sanitized).toBe("elbise");
    });
  });

  describe("Rate Limiting", () => {
    beforeEach(() => {
      resetSearchRateLimiter();
    });

    it("allows up to 60 requests per minute", () => {
      const ip = "192.168.1.100";
      for (let i = 0; i < 60; i++) {
        const check = checkSearchRateLimit(ip);
        expect(check.allowed).toBe(true);
      }

      // 61st request should be blocked
      const blockedCheck = checkSearchRateLimit(ip);
      expect(blockedCheck.allowed).toBe(false);
      expect(blockedCheck.remaining).toBe(0);
    });

    it("tracks different IPs separately", () => {
      const ip1 = "10.0.0.1";
      const ip2 = "10.0.0.2";

      for (let i = 0; i < 60; i++) {
        checkSearchRateLimit(ip1);
      }

      // ip1 is blocked
      expect(checkSearchRateLimit(ip1).allowed).toBe(false);

      // ip2 is still allowed
      expect(checkSearchRateLimit(ip2).allowed).toBe(true);
    });
  });
});
