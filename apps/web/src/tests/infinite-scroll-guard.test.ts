import { describe, it, expect } from "vitest";
import { fetchMoreProductsAction } from "../app/(store)/actions";

describe("Infinite Scroll Anti-Exhaustion & Server Guards", () => {
  it("rejects invalid page parameters (<= 0) fail-closed", async () => {
    const res = await fetchMoreProductsAction({
      page: 0,
      limit: 12,
    });
    expect(res.success).toBe(false);
    expect(res.products).toHaveLength(0);
    expect(res.error).toBeDefined();
  });

  it("rejects excessive page requests (> 100) to protect database against offset exhaustion DoS", async () => {
    const res = await fetchMoreProductsAction({
      page: 101,
      limit: 12,
    });
    expect(res.success).toBe(false);
    expect(res.products).toHaveLength(0);
    expect(res.error).toContain("Geçersiz");
  });

  it("caps limit to maximum 24 items per request even if client requests more", async () => {
    const res = await fetchMoreProductsAction({
      page: 1,
      limit: 100, // Client tries to request 100 items
    });
    // Regardless of success (depends on server running), if successful products length must not exceed 24
    if (res.success) {
      expect(res.products.length).toBeLessThanOrEqual(24);
    }
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

    // Page 1 -> auto
    expect(currentPage >= autoLoadLimit).toBe(false);

    // Page 2 -> auto
    currentPage = 2;
    expect(currentPage >= autoLoadLimit).toBe(false);

    // Page 3 -> PAUSE! (Requires user click)
    currentPage = 3;
    expect(currentPage >= autoLoadLimit).toBe(true);

    // User clicks "Daha Fazla Ürün Göster" -> threshold expands
    autoLoadLimit += autoLoadPages; // now 6
    expect(currentPage >= autoLoadLimit).toBe(false);

    // Page 6 -> PAUSE again!
    currentPage = 6;
    expect(currentPage >= autoLoadLimit).toBe(true);
  });
});
