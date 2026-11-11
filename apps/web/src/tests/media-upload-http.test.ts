import { describe, it, expect } from "vitest";
import { Media } from "../collections/Media";
import { sanitizeUploadFilename } from "../lib/media-utils";
import { ValidationError } from "payload";

describe("Media Upload Validation & 400 Error Handling", () => {
  it("must throw ValidationError (status 400) when uploading SVG filename", () => {
    let error: any;
    try {
      sanitizeUploadFilename("test-malicious.svg");
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.status).toBe(400);
    expect(error.data?.errors?.[0]?.message).toContain("SVG ve çalıştırılabilir dosyalar yasaktır");
  });

  it("must throw ValidationError (status 400) when beforeOperation encounters file > 5 MB", () => {
    const beforeOpHook = Media.hooks?.beforeOperation?.[0];
    expect(beforeOpHook).toBeDefined();

    let error: any;
    try {
      (beforeOpHook as any)({
        operation: "create",
        req: {
          file: {
            size: 6 * 1024 * 1024, // 6 MB
            name: "oversized.png",
            mimetype: "image/png",
          },
        },
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.status).toBe(400);
    expect(error.data?.errors?.[0]?.message).toContain("Dosya boyutu 5 MB sınırını aşamaz");
  });

  it("must throw ValidationError (status 400) when beforeOperation encounters SVG mimetype", () => {
    const beforeOpHook = Media.hooks?.beforeOperation?.[0];
    expect(beforeOpHook).toBeDefined();

    let error: any;
    try {
      (beforeOpHook as any)({
        operation: "create",
        req: {
          file: {
            size: 1024,
            name: "icon.svg",
            mimetype: "image/svg+xml",
          },
        },
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.status).toBe(400);
    expect(error.data?.errors?.[0]?.message).toContain("SVG ve çalıştırılabilir dosyalar yasaktır");
  });

  it("must throw ValidationError (status 400) when beforeChange encounters file > 5 MB", () => {
    const beforeChangeHook = Media.hooks?.beforeChange?.[0];
    expect(beforeChangeHook).toBeDefined();

    let error: any;
    try {
      (beforeChangeHook as any)({
        req: {
          file: {
            size: 6 * 1024 * 1024, // 6 MB
            name: "oversized.png",
          },
        },
        data: {},
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.status).toBe(400);
    expect(error.data?.errors?.[0]?.message).toContain("Dosya boyutu 5 MB sınırını aşamaz");
  });
});
