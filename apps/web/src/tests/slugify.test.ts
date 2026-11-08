import { describe, it, expect } from "vitest";
import { slugify, isReservedSlug, validateSlugField } from "../lib/slugify";

describe("Slugify Utility (Turkish Transliteration & Rules)", () => {
  it("correctly transliterates Turkish characters to lowercase ASCII", () => {
    expect(slugify("Çisem Elif Boz")).toBe("cisem-elif-boz");
    expect(slugify("Ilık Çay & Şeker")).toBe("ilik-cay-seker");
    expect(slugify("Örnek Türkçe Başlık: Şişe, Üzüm, Ağaç")).toBe(
      "ornek-turkce-baslik-sise-uzum-agac",
    );
    expect(slugify("İstanbul Boğazı")).toBe("istanbul-bogazi");
    expect(slugify("IĞDIR ve ÇORUM")).toBe("igdir-ve-corum");
  });

  it("handles leading, trailing, and duplicate hyphens", () => {
    expect(slugify("---test---slug---")).toBe("test-slug");
    expect(slugify("özel    boşluklar   burada")).toBe("ozel-bosluklar-burada");
    expect(slugify("A...B...C")).toBe("a-b-c");
  });

  it("returns empty string for non-string or empty input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("    ")).toBe("");
    expect(slugify(null as any)).toBe("");
  });

  it("identifies reserved slugs correctly", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("blog")).toBe(true);
    expect(isReservedSlug("sepet")).toBe(true);
    expect(isReservedSlug("odeme")).toBe(true);
    expect(isReservedSlug("siparis-onay")).toBe(true);
    expect(isReservedSlug("/sayfa/")).toBe(true);
    expect(isReservedSlug("urunler")).toBe(true);
    expect(isReservedSlug("hakkimizda")).toBe(false);
    expect(isReservedSlug("yeni-blog-yazisi")).toBe(false);
  });

  it("validates slug field correctly", () => {
    expect(validateSlugField("hakkimizda")).toBe(true);
    expect(validateSlugField("yeni-sezon-2026")).toBe(true);
    expect(validateSlugField("")).toBe("Slug alanı zorunludur.");
    expect(validateSlugField("admin")).toContain("rezerve edilmiş bir rota adıdır");
    expect(validateSlugField("blog")).toContain("rezerve edilmiş bir rota adıdır");
    expect(validateSlugField("hatali slug!")).toContain("yalnızca küçük harf");
    expect(validateSlugField("-basinda-tire")).toContain("yalnızca küçük harf");
  });
});
