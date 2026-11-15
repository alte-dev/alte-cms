import { beforeEach, describe, expect, it, vi } from "vitest";
import { medusaFetch } from "./client";
import {
  getCategoryBySlug,
  getCollectionByHandle,
  getProductByHandle,
  getProducts,
} from "./products";

vi.mock("./client", () => ({
  medusaFetch: vi.fn(),
}));

const mockedMedusaFetch = vi.mocked(medusaFetch);

describe("medusa products handle decoding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("decodes URL-encoded Turkish handle once without double-encoding in getProductByHandle", async () => {
    mockedMedusaFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/store/regions")) {
        return { regions: [{ id: "reg_tr", countries: [{ iso_2: "tr" }] }] };
      }
      return { products: [{ id: "prod_1", handle: "ürün-1", title: "Ürün-1" }] };
    });

    await getProductByHandle("%C3%BCr%C3%BCn-1");

    const productCall = mockedMedusaFetch.mock.calls.find(([path]) =>
      path.startsWith("/store/products"),
    );
    expect(productCall).toBeDefined();
    expect(productCall?.[0]).toContain("handle=%C3%BCr%C3%BCn-1&");
    expect(productCall?.[0]).not.toContain("%25C3");
  });

  it("preserves plain UTF-8 handles and safely handles malformed percent sequences", async () => {
    mockedMedusaFetch.mockResolvedValue({ products: [] });

    await getProductByHandle("ürün-1");
    const call1 = mockedMedusaFetch.mock.calls.find(([path]) => path.startsWith("/store/products"));
    expect(call1?.[0]).toContain("handle=%C3%BCr%C3%BCn-1&");

    mockedMedusaFetch.mockClear();
    await expect(getProductByHandle("%E0%A4%A")).resolves.toBeNull();
  });

  it("decodes URL-encoded Turkish slugs in getCategoryBySlug and getCollectionByHandle", async () => {
    mockedMedusaFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/store/product-categories")) {
        return {
          product_categories: [
            { id: "cat_1", handle: "kolyeler-ve-yüzükler", category_children: [] },
          ],
        };
      }
      if (path.startsWith("/store/collections")) {
        return { collections: [{ id: "col_1", handle: "yeni-ürünler" }] };
      }
      return {};
    });

    const cat = await getCategoryBySlug("kolyeler-ve-y%C3%BCz%C3%BCkler");
    expect(cat?.id).toBe("cat_1");

    const col = await getCollectionByHandle("yeni-%C3%BCr%C3%BCnler");
    expect(col?.id).toBe("col_1");
  });

  it("requests +variants.inventory_quantity in getProductByHandle and getProducts fields", async () => {
    mockedMedusaFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/store/regions")) {
        return { regions: [{ id: "reg_tr", countries: [{ iso_2: "tr" }] }] };
      }
      return { products: [], count: 0 };
    });

    await getProductByHandle("test-urun");
    const byHandleCall = mockedMedusaFetch.mock.calls.find(([path]) =>
      path.startsWith("/store/products?handle="),
    );
    expect(decodeURIComponent(byHandleCall?.[0] ?? "")).toContain("+variants.inventory_quantity");

    mockedMedusaFetch.mockClear();
    await getProducts({ limit: 4 });
    const listCall = mockedMedusaFetch.mock.calls.find(([path]) =>
      path.startsWith("/store/products?"),
    );
    expect(decodeURIComponent(listCall?.[0] ?? "")).toContain("+variants.inventory_quantity");
  });
});
