import { describe, it, expect } from "vitest";
import { sanitizeUploadFilename, isAllowedMimeType } from "../lib/media-utils";

describe("Media Utils & Filename Sanitization", () => {
  it("normalizes Turkish characters and spaces in filenames", () => {
    const sanitized = sanitizeUploadFilename("Ürün Fotoğrafı (Yeni) 2026.png");
    expect(sanitized).toMatch(/^urun-fotografi-yeni-2026-\d+\.png$/);
  });

  it("strictly rejects SVG uploads", () => {
    expect(() => sanitizeUploadFilename("logo.svg")).toThrow(/SVG ve çalıştırılabilir dosyalar yasaktır/);
    expect(() => sanitizeUploadFilename("malicious.svgz")).toThrow(/SVG ve çalıştırılabilir dosyalar yasaktır/);
  });

  it("strictly rejects HTML and script uploads", () => {
    expect(() => sanitizeUploadFilename("payload.html")).toThrow(/SVG ve çalıştırılabilir dosyalar yasaktır/);
    expect(() => sanitizeUploadFilename("exploit.php")).toThrow(/SVG ve çalıştırılabilir dosyalar yasaktır/);
  });

  it("validates allowed MIME types (JPEG, PNG, WebP, AVIF) and forbids SVG", () => {
    expect(isAllowedMimeType("image/jpeg")).toBe(true);
    expect(isAllowedMimeType("image/png")).toBe(true);
    expect(isAllowedMimeType("image/webp")).toBe(true);
    expect(isAllowedMimeType("image/avif")).toBe(true);

    expect(isAllowedMimeType("image/svg+xml")).toBe(false);
    expect(isAllowedMimeType("application/xml")).toBe(false);
    expect(isAllowedMimeType("text/html")).toBe(false);
  });
});
