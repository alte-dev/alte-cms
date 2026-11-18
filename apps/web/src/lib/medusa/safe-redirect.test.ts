import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeRedirectPath } from "./safe-redirect";

describe("sanitizeRedirectPath", () => {
  it("allows safe internal relative paths", () => {
    expect(sanitizeRedirectPath("/odeme")).toBe("/odeme");
    expect(sanitizeRedirectPath("/hesap/siparisler?page=2")).toBe("/hesap/siparisler?page=2");
    expect(sanitizeRedirectPath("  /sepet  ")).toBe("/sepet");
  });

  it("rejects external URLs, protocol-relative URLs, backslashes, control chars, whitespace, overly long, and non-allowlisted redirects", () => {
    expect(sanitizeRedirectPath("https://evil.example/phish")).toBe("/hesap");
    expect(sanitizeRedirectPath("https://evil")).toBe("/hesap");
    expect(sanitizeRedirectPath("http://evil.example")).toBe("/hesap");
    expect(sanitizeRedirectPath("//evil.example/odeme")).toBe("/hesap");
    expect(sanitizeRedirectPath("//evil")).toBe("/hesap");
    expect(sanitizeRedirectPath("/\\evil.example")).toBe("/hesap");
    expect(sanitizeRedirectPath("/\\evil")).toBe("/hesap");
    expect(sanitizeRedirectPath("/\t/evil.example")).toBe("/hesap");
    expect(sanitizeRedirectPath("/\t\\evil.example")).toBe("/hesap");
    expect(sanitizeRedirectPath("/%09/evil.example")).toBe("/hesap");
    expect(sanitizeRedirectPath("/ /evil")).toBe("/hesap");
    expect(sanitizeRedirectPath("/\u2028/evil")).toBe("/hesap");
    expect(sanitizeRedirectPath("/\u00a0/evil")).toBe("/hesap");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/hesap");
    expect(sanitizeRedirectPath("/odeme\r\nSet-Cookie: a=1")).toBe("/hesap");
    expect(sanitizeRedirectPath(`/odeme?q=${"a".repeat(2050)}`)).toBe("/hesap");
    expect(sanitizeRedirectPath("/admin")).toBe("/hesap");
    expect(sanitizeRedirectPath("/odeme-sahte")).toBe("/hesap");
    expect(sanitizeRedirectPath("/hesap/../admin")).toBe("/hesap");
    expect(sanitizeRedirectPath("")).toBe("/hesap");
    expect(sanitizeRedirectPath(undefined)).toBe("/hesap");
  });

  it("allows documented safe storefront paths", () => {
    expect(sanitizeRedirectPath("/")).toBe("/");
    expect(sanitizeRedirectPath("/sepet")).toBe("/sepet");
    expect(sanitizeRedirectPath("/urunler?sayfa=2")).toBe("/urunler?sayfa=2");
    expect(sanitizeRedirectPath("/urun/ornek-urun#ozellikler")).toBe("/urun/ornek-urun#ozellikler");
    expect(sanitizeRedirectPath("/hesap")).toBe("/hesap");
  });

  it("uses custom fallback when provided", () => {
    expect(sanitizeRedirectPath("https://evil.example", "/")).toBe("/");
  });

  it("ensures giris, kayit, dogrula pages and account auth components all use sanitizeRedirectPath", () => {
    const webSrc = path.resolve(__dirname, "../..");
    const files = [
      "app/(store)/hesap/giris/page.tsx",
      "app/(store)/hesap/kayit/page.tsx",
      "app/(store)/hesap/dogrula/page.tsx",
      "components/account/LoginForm.tsx",
      "components/account/RegisterForm.tsx",
      "components/account/VerifyEmailClient.tsx",
      "components/account/OtpVerificationCard.tsx",
    ];
    for (const rel of files) {
      const content = fs.readFileSync(path.join(webSrc, rel), "utf8");
      expect(content, `${rel} must use sanitizeRedirectPath`).toContain("sanitizeRedirectPath");
      expect(content, `${rel} must not pass raw redirectTo to router.push`).not.toContain(
        "router.push(redirectTo)",
      );
      expect(content, `${rel} must not pass raw params.redirect to redirect()`).not.toContain(
        "redirect(params.redirect)",
      );
    }
  });
});
