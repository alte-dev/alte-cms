import { describe, it, expect } from "vitest";
import { sanitizeUploadFilename, isAllowedMimeType } from "../lib/media-utils";

describe("Media Utils & Filename Sanitization", () => {
  it("normalizes Turkish characters and spaces in filenames", () => {
    const sanitized = sanitizeUploadFilename("Ürün Fotoğrafı (Yeni) 2026.png");
    expect(sanitized).toMatch(/^urun-fotografi-yeni-2026-\d+\.png$/);
  });

  it("strictly rejects SVG uploads", () => {
    let err1: any;
    try {
      sanitizeUploadFilename("logo.svg");
    } catch (e) {
      err1 = e;
    }
    expect(err1?.status).toBe(400);
    expect(err1?.data?.errors?.[0]?.message).toMatch(/SVG ve çalıştırılabilir dosyalar yasaktır/);

    let err2: any;
    try {
      sanitizeUploadFilename("malicious.svgz");
    } catch (e) {
      err2 = e;
    }
    expect(err2?.status).toBe(400);
    expect(err2?.data?.errors?.[0]?.message).toMatch(/SVG ve çalıştırılabilir dosyalar yasaktır/);
  });

  it("strictly rejects HTML and script uploads", () => {
    let err1: any;
    try {
      sanitizeUploadFilename("payload.html");
    } catch (e) {
      err1 = e;
    }
    expect(err1?.status).toBe(400);
    expect(err1?.data?.errors?.[0]?.message).toMatch(/SVG ve çalıştırılabilir dosyalar yasaktır/);

    let err2: any;
    try {
      sanitizeUploadFilename("exploit.php");
    } catch (e) {
      err2 = e;
    }
    expect(err2?.status).toBe(400);
    expect(err2?.data?.errors?.[0]?.message).toMatch(/SVG ve çalıştırılabilir dosyalar yasaktır/);
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
