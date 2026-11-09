import { medusaFetch } from "./client";
import {
  StoreCategoryListResponse,
  StoreCollectionListResponse,
  StoreProduct,
  StoreProductCategory,
  StoreProductListResponse,
  StoreProductResponse,
  StoreRegion,
  StoreRegionListResponse,
} from "./types";

interface ExtraTypes {
  StoreProductListResponse: {
    products: StoreProduct[];
    count: number;
    offset: number;
    limit: number;
  };
}

let cachedDefaultRegion: StoreRegion | null = null;

/**
 * Retrieves the default Türkiye store region.
 */
export async function getDefaultRegion(): Promise<StoreRegion | null> {
  if (cachedDefaultRegion) {
    return cachedDefaultRegion;
  }

  try {
    const data = await medusaFetch<StoreRegionListResponse>("/store/regions", {
      next: { revalidate: 3600 },
    });
    const turkeyRegion =
      data.regions.find((r) => r.currency_code === "try" || r.name.includes("Türkiye")) ||
      data.regions[0] ||
      null;

    if (turkeyRegion) {
      cachedDefaultRegion = turkeyRegion;
    }
    return turkeyRegion;
  } catch {
    return null;
  }
}

/**
 * Retrieves all product categories.
 */
export async function getCategories(): Promise<StoreProductCategory[]> {
  try {
    const data = await medusaFetch<StoreCategoryListResponse>(
      "/store/product-categories?fields=*category_children&limit=50",
      { next: { revalidate: 300 } },
    );
    return data.product_categories || [];
  } catch {
    return [];
  }
}

/**
 * Finds a single product category by slug/handle.
 */
export async function getCategoryBySlug(slug: string): Promise<StoreProductCategory | null> {
  const categories = await getCategories();
  const searchTree = (cats: StoreProductCategory[]): StoreProductCategory | null => {
    for (const c of cats) {
      if (c.handle === slug) return c;
      if (c.category_children && c.category_children.length > 0) {
        const found = searchTree(c.category_children);
        if (found) return found;
      }
    }
    return null;
  };

  return searchTree(categories);
}

/**
 * Retrieves all product collections.
 */
export async function getCollections(): Promise<any[]> {
  try {
    const data = await medusaFetch<StoreCollectionListResponse>("/store/collections?limit=50", {
      next: { revalidate: 300 },
    });
    return data.collections || [];
  } catch {
    return [];
  }
}

/**
 * Retrieves a collection by handle.
 */
export async function getCollectionByHandle(handle: string): Promise<any | null> {
  const collections = await getCollections();
  return collections.find((c) => c.handle === handle) || null;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  sort?: "created_at" | "price_asc" | "price_desc";
  category_id?: string;
  collection_id?: string;
  q?: string;
}

/**
 * Lists products from Medusa Store API with region-specific calculated pricing.
 */
export async function getProducts(params: GetProductsParams = {}): Promise<{
  products: StoreProduct[];
  count: number;
  totalPages: number;
  currentPage: number;
}> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 12));
  const offset = (page - 1) * limit;

  const region = await getDefaultRegion();
  const queryParams = new URLSearchParams();

  if (region) {
    queryParams.set("region_id", region.id);
  }

  queryParams.set("limit", String(limit));
  queryParams.set("offset", String(offset));
  queryParams.set(
    "fields",
    "*variants.calculated_price,*variants.options,*options,*categories,*collection",
  );

  if (params.category_id) {
    queryParams.set("category_id[]", params.category_id);
  }

  if (params.collection_id) {
    queryParams.set("collection_id[]", params.collection_id);
  }

  if (params.q) {
    queryParams.set("q", params.q);
  }

  if (params.sort === "created_at") {
    queryParams.set("order", "-created_at");
  }

  try {
    const data = await medusaFetch<{ products: StoreProduct[]; count: number }>(
      `/store/products?${queryParams.toString()}`,
      { cache: "no-store" },
    );

    let products = data.products || [];

    // Exclude hidden service products (e.g. Kapıda Ödeme Hizmet Bedeli)
    products = products.filter(
      (p) =>
        p.metadata?.is_cod_fee !== true &&
        p.handle !== "kapida-odeme-hizmet-bedeli" &&
        !p.variants?.some((v) => v.sku === "SERVICE-COD-FEE"),
    );

    // Client-side sorting for calculated price if requested
    if (params.sort === "price_asc") {
      products = [...products].sort((a, b) => {
        const priceA = a.variants?.[0]?.calculated_price?.calculated_amount ?? 0;
        const priceB = b.variants?.[0]?.calculated_price?.calculated_amount ?? 0;
        return priceA - priceB;
      });
    } else if (params.sort === "price_desc") {
      products = [...products].sort((a, b) => {
        const priceA = a.variants?.[0]?.calculated_price?.calculated_amount ?? 0;
        const priceB = b.variants?.[0]?.calculated_price?.calculated_amount ?? 0;
        return priceB - priceA;
      });
    }

    const count = data.count || products.length;
    const totalPages = Math.ceil(count / limit) || 1;

    return {
      products,
      count,
      totalPages,
      currentPage: page,
    };
  } catch {
    return {
      products: [],
      count: 0,
      totalPages: 1,
      currentPage: 1,
    };
  }
}

/**
 * Retrieves a single product by handle.
 */
export async function getProductByHandle(handle: string): Promise<StoreProduct | null> {
  const region = await getDefaultRegion();
  const queryParams = new URLSearchParams();

  if (region) {
    queryParams.set("region_id", region.id);
  }
  queryParams.set(
    "fields",
    "*variants.calculated_price,*variants.options,*options,*categories,*collection",
  );

  try {
    const data = await medusaFetch<{ products: StoreProduct[] }>(
      `/store/products?handle=${encodeURIComponent(handle)}&${queryParams.toString()}`,
      { cache: "no-store" },
    );

    return data.products?.[0] || null;
  } catch {
    return null;
  }
}

export interface SearchProductsParams {
  q: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "newest";
  limit?: number;
  offset?: number;
}

export interface SearchProductsResponse {
  products: StoreProduct[];
  count: number;
  limit: number;
  offset: number;
  query: string;
}

/**
 * Searches products from Medusa Store API using PostgreSQL pg_trgm + unaccent.
 */
export async function searchProducts(
  params: SearchProductsParams,
): Promise<SearchProductsResponse> {
  const queryParams = new URLSearchParams();
  queryParams.set("q", params.q);

  if (params.category) queryParams.set("category", params.category);
  if (params.min_price !== undefined) queryParams.set("min_price", String(params.min_price));
  if (params.max_price !== undefined) queryParams.set("max_price", String(params.max_price));
  if (params.in_stock) queryParams.set("in_stock", "true");
  if (params.sort) queryParams.set("sort", params.sort);
  if (params.limit) queryParams.set("limit", String(params.limit));
  if (params.offset) queryParams.set("offset", String(params.offset));

  try {
    const data = await medusaFetch<SearchProductsResponse>(
      `/store/search?${queryParams.toString()}`,
      { cache: "no-store" },
    );
    return data;
  } catch {
    return {
      products: [],
      count: 0,
      limit: params.limit || 12,
      offset: params.offset || 0,
      query: params.q,
    };
  }
}
