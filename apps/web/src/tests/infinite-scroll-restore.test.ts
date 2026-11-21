import { describe, it, expect, beforeEach } from "vitest";
import {
  buildInfiniteGridStorageKey,
  saveInfiniteGridSnapshot,
  loadInfiniteGridSnapshot,
  clearInfiniteGridSnapshot,
  markBackNavigation,
  consumeBackNavigation,
  resetBackNavigationForTest,
  INFINITE_GRID_TTL_MS,
} from "../lib/infinite-scroll-state";
import type { StoreProduct } from "../lib/medusa/types";

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

function makeProduct(id: string): StoreProduct {
  return {
    id,
    title: `Ürün ${id}`,
    handle: `urun-${id}`,
    description: null,
    thumbnail: null,
    images: [],
    variants: [],
    categories: [],
  } as unknown as StoreProduct;
}

describe("Infinite Scroll State Persistence & Back-Navigation Restore", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    resetBackNavigationForTest();
  });

  it("builds distinct storage keys per pathname and query string", () => {
    expect(buildInfiniteGridStorageKey("/urunler", "")).toBe("alte:infinite-grid:/urunler");
    expect(buildInfiniteGridStorageKey("/urunler", "?sort=price_asc")).toBe(
      "alte:infinite-grid:/urunler?sort=price_asc",
    );
    expect(buildInfiniteGridStorageKey("/kategori/tisort", "")).toBe(
      "alte:infinite-grid:/kategori/tisort",
    );
  });

  it("saves and restores loaded products, page, hasMore, autoLoadLimit, and scrollY", () => {
    const key = buildInfiniteGridStorageKey("/urunler", "");
    const products = [makeProduct("p1"), makeProduct("p2"), makeProduct("p3")];

    saveInfiniteGridSnapshot(
      storage,
      key,
      {
        products,
        page: 3,
        hasMore: false,
        autoLoadLimit: 6,
        scrollY: 2450,
        category: undefined,
        sort: "created_at",
        limit: 12,
      },
      1000,
    );

    const restored = loadInfiniteGridSnapshot(
      storage,
      key,
      { category: undefined, sort: "created_at", limit: 12, initialFirstId: "p1" },
      2000,
    );

    expect(restored).not.toBeNull();
    expect(restored?.products.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(restored?.page).toBe(3);
    expect(restored?.hasMore).toBe(false);
    expect(restored?.autoLoadLimit).toBe(6);
    expect(restored?.scrollY).toBe(2450);
  });

  it("returns null when snapshot is expired beyond TTL", () => {
    const key = buildInfiniteGridStorageKey("/urunler", "");
    saveInfiniteGridSnapshot(
      storage,
      key,
      {
        products: [makeProduct("p1")],
        page: 2,
        hasMore: true,
        autoLoadLimit: 3,
        scrollY: 1200,
        limit: 12,
      },
      1000,
    );

    const expired = loadInfiniteGridSnapshot(
      storage,
      key,
      { limit: 12, initialFirstId: "p1" },
      1000 + INFINITE_GRID_TTL_MS + 1,
    );
    expect(expired).toBeNull();
  });

  it("returns null when category, sort, limit, or initialFirstId mismatches", () => {
    const key = buildInfiniteGridStorageKey("/urunler", "");
    saveInfiniteGridSnapshot(
      storage,
      key,
      {
        products: [makeProduct("p1"), makeProduct("p2")],
        page: 2,
        hasMore: true,
        autoLoadLimit: 3,
        scrollY: 900,
        category: "tisort",
        sort: "price_asc",
        limit: 12,
      },
      1000,
    );

    expect(
      loadInfiniteGridSnapshot(
        storage,
        key,
        { category: "pantolon", sort: "price_asc", limit: 12, initialFirstId: "p1" },
        2000,
      ),
    ).toBeNull();

    expect(
      loadInfiniteGridSnapshot(
        storage,
        key,
        { category: "tisort", sort: "price_desc", limit: 12, initialFirstId: "p1" },
        2000,
      ),
    ).toBeNull();

    expect(
      loadInfiniteGridSnapshot(
        storage,
        key,
        { category: "tisort", sort: "price_asc", limit: 24, initialFirstId: "p1" },
        2000,
      ),
    ).toBeNull();

    expect(
      loadInfiniteGridSnapshot(
        storage,
        key,
        { category: "tisort", sort: "price_asc", limit: 12, initialFirstId: "p999" },
        2000,
      ),
    ).toBeNull();
  });

  it("handles corrupted JSON and storage errors gracefully without throwing", () => {
    const key = buildInfiniteGridStorageKey("/urunler", "");
    storage.setItem(key, "{invalid-json");
    expect(loadInfiniteGridSnapshot(storage, key, { limit: 12 }, 1000)).toBeNull();

    const throwingStorage = {
      ...storage,
      setItem() {
        throw new Error("QuotaExceededError");
      },
      getItem() {
        throw new Error("SecurityError");
      },
      removeItem() {
        throw new Error("SecurityError");
      },
    } as Storage;

    expect(() =>
      saveInfiniteGridSnapshot(
        throwingStorage,
        key,
        {
          products: [makeProduct("p1")],
          page: 1,
          hasMore: false,
          autoLoadLimit: 3,
          scrollY: 0,
          limit: 12,
        },
        1000,
      ),
    ).not.toThrow();
    expect(loadInfiniteGridSnapshot(throwingStorage, key, { limit: 12 }, 1000)).toBeNull();
    expect(() => clearInfiniteGridSnapshot(throwingStorage, key)).not.toThrow();
  });

  it("tracks and consumes back navigation from popstate or back_forward", () => {
    expect(consumeBackNavigation(1000, "navigate")).toBe(false);

    markBackNavigation(1000);
    expect(consumeBackNavigation(1500, "navigate")).toBe(true);
    // Consumed once
    expect(consumeBackNavigation(1600, "navigate")).toBe(false);

    // Expired popstate (> 2000ms)
    markBackNavigation(1000);
    expect(consumeBackNavigation(3500, "navigate")).toBe(false);

    // Browser full-load back_forward
    expect(consumeBackNavigation(4000, "back_forward")).toBe(true);
    // Consumed once
    expect(consumeBackNavigation(4100, "back_forward")).toBe(false);
  });
});
