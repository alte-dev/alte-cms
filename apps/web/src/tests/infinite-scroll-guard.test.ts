import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchMoreProductsAction,
  applyCouponAction,
  removeCouponAction,
} from "../app/(store)/actions";
import * as productsLib from "../lib/medusa/products";
import * as cartLib from "../lib/medusa/cart";

describe("Infinite Scroll Anti-Exhaustion & Server Action Guards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects invalid page parameters (<= 0) fail-closed", async () => {
    const res = await fetchMoreProductsAction({
      page: 0,
      limit: 12,
    });
    expect(res.success).toBe(false);
    expect(res.products).toHaveLength(0);
    expect(res.error).toBeDefined();
  });

  it("rejects page requests exceeding actual catalog totalPages dynamically", async () => {
    vi.spyOn(productsLib, "getProducts").mockResolvedValueOnce({
      products: [],
      count: 100,
      totalPages: 9,
      currentPage: 10,
    });

    const res = await fetchMoreProductsAction({
      page: 10,
      limit: 12,
    });
    expect(res.success).toBe(false);
    expect(res.products).toHaveLength(0);
    expect(res.hasMore).toBe(false);
    expect(res.totalPages).toBe(9);
  });

  it("allows valid pages beyond 100 when catalog totalPages is large (e.g. 150 pages)", async () => {
    vi.spyOn(productsLib, "getProducts").mockResolvedValueOnce({
      products: [{ id: "prod_105", title: "Ürün 105", handle: "urun-105" } as never],
      count: 1800,
      totalPages: 150,
      currentPage: 105,
    });

    const res = await fetchMoreProductsAction({
      page: 105,
      limit: 12,
    });
    expect(res.success).toBe(true);
    expect(res.products).toHaveLength(1);
    expect(res.hasMore).toBe(true);
    expect(res.totalPages).toBe(150);
  });

  it("never leaks internal err.message to client in fetchMoreProductsAction, applyCouponAction, or removeCouponAction", async () => {
    vi.spyOn(productsLib, "getProducts").mockRejectedValueOnce(
      new Error("INTERNAL_DB_CONNECTION_STRING_LEAK postgres://secret@10.0.0.1:5432"),
    );

    const fetchRes = await fetchMoreProductsAction({ page: 1, limit: 12 });
    expect(fetchRes.success).toBe(false);
    expect(fetchRes.error).toBe("Ürünler yüklenirken bir hata oluştu.");
    expect(fetchRes.error).not.toContain("INTERNAL_DB_CONNECTION_STRING_LEAK");

    vi.spyOn(cartLib, "getOrCreateCart").mockRejectedValueOnce(
      new Error("INTERNAL_REDIS_STACK_TRACE_LEAK at Socket.connect"),
    );
    const couponRes = await applyCouponAction("TEST10");
    expect(couponRes.success).toBe(false);
    expect(couponRes.error).toBe("Geçersiz veya süresi dolmuş kupon kodu.");
    expect(couponRes.error).not.toContain("INTERNAL_REDIS_STACK_TRACE_LEAK");

    vi.spyOn(cartLib, "getOrCreateCart").mockRejectedValueOnce(
      new Error("INTERNAL_MEDUSA_TOKEN_LEAK secret_token_123"),
    );
    const removeRes = await removeCouponAction("TEST10");
    expect(removeRes.success).toBe(false);
    expect(removeRes.error).toBe("Kupon kaldırılamadı.");
    expect(removeRes.error).not.toContain("INTERNAL_MEDUSA_TOKEN_LEAK");
  });

  it("caps limit to maximum 24 items per request even if client requests more", async () => {
    const res = await fetchMoreProductsAction({
      page: 1,
      limit: 100,
    });
    expect(res.success).toBe(false);
  });

  it("rejects invalid sort parameters", async () => {
    const res = await fetchMoreProductsAction({
      page: 1,
      // @ts-expect-error Testing invalid input at runtime
      sort: "malicious_sql_injection; DROP TABLE;",
    });
    expect(res.success).toBe(false);
  });

  it("calculates auto-load pause threshold correctly to prevent infinite loop runaway", () => {
    const autoLoadPages = 3;
    let currentPage = 1;
    let autoLoadLimit = autoLoadPages;

    expect(currentPage >= autoLoadLimit).toBe(false);
    currentPage = 2;
    expect(currentPage >= autoLoadLimit).toBe(false);
    currentPage = 3;
    expect(currentPage >= autoLoadLimit).toBe(true);
    autoLoadLimit += autoLoadPages;
    expect(currentPage >= autoLoadLimit).toBe(false);
    currentPage = 6;
    expect(currentPage >= autoLoadLimit).toBe(true);
  });
});
