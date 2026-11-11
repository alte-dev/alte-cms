import { describe, it, expect } from "vitest";
import { Media, validateFileSize, MAX_FILE_SIZE_BYTES } from "../collections/Media";

describe("Payload Media Collection Validation", () => {
  it("must enforce 5 MB max file size limit", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);

    const fourMb = 4 * 1024 * 1024;
    const exactlyFiveMb = 5 * 1024 * 1024;
    const fiveMbPlusOneByte = 5 * 1024 * 1024 + 1;
    const tenMb = 10 * 1024 * 1024;

    expect(validateFileSize(fourMb)).toBe(true);
    expect(validateFileSize(exactlyFiveMb)).toBe(true);
    expect(validateFileSize(fiveMbPlusOneByte)).toBe(false);
    expect(validateFileSize(tenMb)).toBe(false);
  });

  it("must strictly exclude SVG from allowed mimeTypes to prevent XSS", () => {
    const uploadConfig = Media.upload as any;
    expect(uploadConfig).toBeDefined();
    expect(uploadConfig.mimeTypes).toBeDefined();

    expect(uploadConfig.mimeTypes).not.toContain("image/svg+xml");
    expect(uploadConfig.mimeTypes).not.toContain("image/svg");
  });

  it("must whitelist safe raster image formats", () => {
    const uploadConfig = Media.upload as any;
    expect(uploadConfig.mimeTypes).toContain("image/jpeg");
    expect(uploadConfig.mimeTypes).toContain("image/png");
    expect(uploadConfig.mimeTypes).toContain("image/webp");
  });

  it("must reject oversized files in beforeChange hook with ValidationError (HTTP 400)", async () => {
    const hook = Media.hooks?.beforeChange?.[0];
    expect(hook).toBeDefined();

    const mockOversizedReq = {
      file: {
        size: 6 * 1024 * 1024, // 6 MB
        name: "test-large.jpg",
      },
    };

    let error: any;
    try {
      (hook as any)({
        req: mockOversizedReq,
        data: {},
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(400);
    expect(error.data?.errors?.[0]?.message).toContain("Dosya boyutu 5 MB sınırını aşamaz");
  });
});
