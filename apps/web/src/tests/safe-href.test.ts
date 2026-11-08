import { describe, it, expect } from "vitest";
import { isSafeHref, safeHref, validateSafeHrefField } from "../lib/safe-href";

describe("Safe Href Utility (Security & Protocol Validation)", () => {
  it("accepts valid internal paths starting with single '/'", () => {
    expect(isSafeHref("/")).toBe(true);
    expect(isSafeHref("/blog")).toBe(true);
    expect(isSafeHref("/urun/deri-ceket")).toBe(true);
    expect(isSafeHref("/sayfa/hakkimizda?ref=header#vision")).toBe(true);
    expect(safeHref("/iletisim")).toBe("/iletisim");
  });

  it("accepts valid secure external https:// URLs", () => {
    expect(isSafeHref("https://instagram.com/alte")).toBe(true);
    expect(isSafeHref("https://paytr.com/odeme")).toBe(true);
    expect(isSafeHref("https://maps.google.com/?q=istanbul")).toBe(true);
  });

  it("rejects dangerous javascript: URIs (case-insensitive & encoded)", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("JAVASCRIPT:alert('XSS')")).toBe(false);
    expect(isSafeHref("  javascript:void(0)  ")).toBe(false);
    expect(isSafeHref("javascript :alert(1)")).toBe(false);
  });

  it("rejects dangerous data: and vbscript: URIs", () => {
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHref("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHref("file:///etc/passwd")).toBe(false);
  });

  it("rejects protocol-relative and backslash traversal bypasses", () => {
    expect(isSafeHref("//evil.com")).toBe(false);
    expect(isSafeHref("//evil.com/phish")).toBe(false);
    expect(isSafeHref("\\\\evil.com")).toBe(false);
    expect(isSafeHref("/\\evil.com")).toBe(false);
    expect(isSafeHref("/test\\path")).toBe(false);
  });

  it("rejects plain http:// URLs when external (https required)", () => {
    expect(isSafeHref("http://insecure-site.com")).toBe(false);
  });

  it("returns fallback for unsafe hrefs", () => {
    expect(safeHref("javascript:evil()", "/")).toBe("/");
    expect(safeHref("//evil.com", "/fallback")).toBe("/fallback");
    expect(safeHref(null as any, "/")).toBe("/");
  });

  it("validates field correctly for Payload CMS forms", () => {
    expect(validateSafeHrefField("/hakkimizda")).toBe(true);
    expect(validateSafeHrefField("https://twitter.com")).toBe(true);
    expect(validateSafeHrefField("")).toBe(true); // Optional
    expect(validateSafeHrefField("javascript:alert(1)")).toContain("Bağlantı adresi yalnızca '/'");
    expect(validateSafeHrefField("//evil.com")).toContain("Bağlantı adresi yalnızca '/'");
  });
});
