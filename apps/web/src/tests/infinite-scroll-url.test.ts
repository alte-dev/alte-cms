import { describe, it, expect, beforeEach } from "vitest";
import {
  buildInfinitePagesUrl,
  buildInfiniteScrollKey,
  saveInfiniteScrollY,
  loadInfiniteScrollY,
  clearInfiniteScrollY,
  markBackNavigation,
  markForwardNavigation,
  consumeBackNavigation,
  resetBackNavigationForTest,
  INFINITE_SCROLL_TTL_MS,
} from "../lib/infinite-scroll-url";
import { ProductQuerySchema } from "../lib/medusa/validation";

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe("Infinite Scroll URL (?pages=N) & ScrollY Persistence", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    resetBackNavigationForTest();
  });

  it("builds URLs with pages query param while preserving existing filters", () => {
    expect(buildInfinitePagesUrl("/urunler", "", 1)).toBe("/urunler");
    expect(buildInfinitePagesUrl("/urunler", "?pages=3", 1)).toBe("/urunler");
    expect(buildInfinitePagesUrl("/urunler", "", 3)).toBe("/urunler?pages=3");
    expect(buildInfinitePagesUrl("/urunler", "?category=tisort&sort=price_asc", 4)).toBe(
      "/urunler?category=tisort&sort=price_asc&pages=4",
    );
    expect(buildInfinitePagesUrl("/kategori/giyim", "?sort=price_desc&pages=2", 3)).toBe(
      "/kategori/giyim?sort=price_desc&pages=3",
    );
  });

  it("saves, loads, and clears scrollY per listing URL with TTL", () => {
    const key = buildInfiniteScrollKey("/urunler", "?pages=3");
    saveInfiniteScrollY(storage, key, 2150, 1000);

    expect(loadInfiniteScrollY(storage, key, 2000)).toBe(2150);
    expect(loadInfiniteScrollY(storage, key, 1000 + INFINITE_SCROLL_TTL_MS + 1)).toBeNull();

    clearInfiniteScrollY(storage, key);
    expect(loadInfiniteScrollY(storage, key, 2000)).toBeNull();
  });

  it("tracks back navigation with 30s window and clears on forward click", () => {
    expect(consumeBackNavigation(1000, "navigate")).toBe(false);

    markBackNavigation(1000);
    expect(consumeBackNavigation(6000, "navigate")).toBe(true);

    markForwardNavigation();
    expect(consumeBackNavigation(6100, "navigate")).toBe(false);

    markBackNavigation(1000);
    expect(consumeBackNavigation(35000, "navigate")).toBe(false);

    expect(consumeBackNavigation(40000, "back_forward")).toBe(true);
    expect(consumeBackNavigation(40100, "back_forward")).toBe(false);
  });

  it("validates pages param in ProductQuerySchema", () => {
    const valid = ProductQuerySchema.safeParse({ pages: "3", sort: "price_asc" });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.pages).toBe(3);
    }

    const empty = ProductQuerySchema.safeParse({});
    expect(empty.success).toBe(true);
    if (empty.success) {
      expect(empty.data.pages).toBeUndefined();
    }
  });
});
