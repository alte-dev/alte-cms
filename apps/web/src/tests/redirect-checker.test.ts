import { describe, it, expect } from "vitest";
import {
  normalizeRedirectPath,
  validateRedirectEndpoints,
  isCircularRedirect,
} from "../lib/redirect-checker";

describe("Redirect Checker & Loop Detection", () => {
  it("normalizes redirect paths correctly", () => {
    expect(normalizeRedirectPath("hakkimizda/")).toBe("/hakkimizda");
    expect(normalizeRedirectPath("/BLOG/")).toBe("/blog");
    expect(normalizeRedirectPath("/")).toBe("/");
  });

  it("rejects self redirects (A -> A)", () => {
    const res = validateRedirectEndpoints("/hakkimizda", "/hakkimizda/");
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Kendi kendine yönlendirme yapılamaz/);
  });

  it("rejects unsafe targets", () => {
    const res = validateRedirectEndpoints("/sayfa", "javascript:alert(1)");
    expect(res.valid).toBe(false);
  });

  it("accepts valid internal and https redirects", () => {
    const internal = validateRedirectEndpoints("/eski-urun", "/yeni-urun");
    expect(internal.valid).toBe(true);

    const external = validateRedirectEndpoints("/destek", "https://help.example.com");
    expect(external.valid).toBe(true);
  });

  it("detects direct circular loop (A -> B, B -> A)", () => {
    const existing = [{ from: "/b", to: "/a" }];
    const loop = isCircularRedirect("/a", "/b", existing);
    expect(loop).toBe(true);
  });

  it("detects multi-hop circular loop (A -> B, B -> C, C -> A)", () => {
    const existing = [
      { from: "/b", to: "/c" },
      { from: "/c", to: "/a" },
    ];
    const loop = isCircularRedirect("/a", "/b", existing);
    expect(loop).toBe(true);
  });

  it("allows non-looping chains (A -> B, B -> C, C -> D)", () => {
    const existing = [
      { from: "/b", to: "/c" },
      { from: "/c", to: "/d" },
    ];
    const loop = isCircularRedirect("/a", "/b", existing);
    expect(loop).toBe(false);
  });
});
