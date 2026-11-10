import { describe, it, expect } from "vitest";
import { Media } from "../collections/Media";
import config from "../payload.config";

describe("Payload Media Resizing and Sharp Integration", () => {
  it("must configure sharp in payload.config.ts", async () => {
    const resolvedConfig = await config;
    expect(resolvedConfig.sharp).toBeDefined();
    expect(typeof resolvedConfig.sharp).toBe("function");
  });

  it("must define required image sizes (thumbnail: 400, medium/card: 800, large/hero: 1600)", () => {
    const uploadConfig = Media.upload as any;
    expect(uploadConfig).toBeDefined();
    expect(uploadConfig.imageSizes).toBeDefined();
    expect(Array.isArray(uploadConfig.imageSizes)).toBe(true);

    const sizeMap = new Map(uploadConfig.imageSizes.map((s: any) => [s.name, s.width]));

    expect(sizeMap.get("thumbnail")).toBe(400);
    // 800px card/medium and 1600px hero/large
    expect(sizeMap.get("medium")).toBe(800);
    expect(sizeMap.get("large")).toBe(1600);
  });

  it("must enforce alt field requirement on Media collection", () => {
    const altField = Media.fields.find((f: any) => f.name === "alt");
    expect(altField).toBeDefined();
    expect((altField as any).required).toBe(true);
  });

  it("must successfully resize real raster images with sharp", async () => {
    const resolvedConfig = await config;
    const sharp = resolvedConfig.sharp as any;
    expect(sharp).toBeDefined();

    // Create a dummy 1920x1080 PNG buffer with sharp
    const inputBuffer = await sharp({
      create: {
        width: 1920,
        height: 1080,
        channels: 4,
        background: { r: 50, g: 100, b: 150, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    expect(inputBuffer).toBeInstanceOf(Buffer);

    // Test thumbnail (400)
    const thumbBuffer = await sharp(inputBuffer).resize(400).png().toBuffer();
    const thumbMeta = await sharp(thumbBuffer).metadata();
    expect(thumbMeta.width).toBe(400);

    // Test card (800)
    const cardBuffer = await sharp(inputBuffer).resize(800).png().toBuffer();
    const cardMeta = await sharp(cardBuffer).metadata();
    expect(cardMeta.width).toBe(800);

    // Test hero (1600)
    const heroBuffer = await sharp(inputBuffer).resize(1600).png().toBuffer();
    const heroMeta = await sharp(heroBuffer).metadata();
    expect(heroMeta.width).toBe(1600);
  });
});
