import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "./safe-redirect";

describe("sanitizeRedirectPath", () => {
  it("allows safe internal relative paths", () => {
    expect(sanitizeRedirectPath("/odeme")).toBe("/odeme");
    expect(sanitizeRedirectPath("/hesap/siparisler?page=2")).toBe("/hesap/siparisler?page=2");
    expect(sanitizeRedirectPath("  /sepet  ")).toBe("/sepet");
  });

  it("rejects external URLs, protocol-relative URLs, backslashes, and control chars", () => {
    expect(sanitizeRedirectPath("https://evil.example/phish")).toBe("/hesap");
    expect(sanitizeRedirectPath("http://evil.example")).toBe("/hesap");
    expect(sanitizeRedirectPath("//evil.example/odeme")).toBe("/hesap");
    expect(sanitizeRedirectPath("/\\evil.example")).toBe("/hesap");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/hesap");
    expect(sanitizeRedirectPath("/odeme\r\nSet-Cookie: a=1")).toBe("/hesap");
    expect(sanitizeRedirectPath("")).toBe("/hesap");
    expect(sanitizeRedirectPath(undefined)).toBe("/hesap");
  });

  it("uses custom fallback when provided", () => {
    expect(sanitizeRedirectPath("https://evil.example", "/")).toBe("/");
  });
});
