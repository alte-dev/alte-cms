import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  validateSearchQuery,
  escapeLikeWildcards,
  normalizeTurkishText,
  checkSearchRateLimit,
} from "../../../utils/turkish-search";

interface RawProductMatch {
  id: string;
  relevance_score: number;
}

/**
 * GET /store/search
 * High-performance, Turkish-aware, PostgreSQL trigram & unaccent search API.
 * Rate limited to 60 req/min per IP.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  // 1. Rate Limiting Check (60 requests / minute per client IP)
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "127.0.0.1";

  const rateCheck = checkSearchRateLimit(clientIp);
  if (!rateCheck.allowed) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({
      error: "Çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar deneyin.",
    });
    return;
  }

  // 2. Validate and Sanitize Search Query 'q'
  const validation = validateSearchQuery(req.query.q);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const rawQ = validation.sanitized;
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit as string, 10) || 12));
  const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
  const sort = (req.query.sort as string) || "relevance";
  const categoryFilter = (req.query.category as string)?.trim() || null;
  const inStockOnly = req.query.in_stock === "true";
  const minPrice = req.query.min_price ? parseFloat(req.query.min_price as string) : null;
  const maxPrice = req.query.max_price ? parseFloat(req.query.max_price as string) : null;

  // Resolve Database Connection (Knex)
  let pgConnection: any = null;
  try {
    pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");
  } catch {
    // handled below
  }

  const escapedLike = escapeLikeWildcards(rawQ);
  const likePattern = `%${escapedLike}%`;
  const exactPattern = escapedLike;
  const prefixPattern = `${escapedLike}%`;
  const normalizedTurkish = `%${normalizeTurkishText(rawQ)}%`;

  let matchedProductIds: string[] = [];
  const relevanceMap = new Map<string, number>();

  if (pgConnection && typeof pgConnection.raw === "function") {
    try {
      // Parameterized SQL query utilizing pg_trgm and unaccent
      const sql = `
        SELECT 
          p.id,
          (
            CASE 
              WHEN p.title ILIKE :exactPattern THEN 100
              WHEN p.title ILIKE :prefixPattern THEN 80
              WHEN p.title ILIKE :likePattern THEN 60
              WHEN unaccent(p.title) ILIKE unaccent(:likePattern) THEN 50
              WHEN unaccent(lower(p.title)) ILIKE :normalizedTurkish THEN 45
              WHEN similarity(p.title, :rawQ) > 0.15 THEN (similarity(p.title, :rawQ) * 40)::int
              ELSE 0
            END +
            CASE 
              WHEN p.subtitle IS NOT NULL AND p.subtitle ILIKE :likePattern THEN 25
              WHEN p.subtitle IS NOT NULL AND unaccent(p.subtitle) ILIKE unaccent(:likePattern) THEN 20
              ELSE 0
            END +
            CASE 
              WHEN EXISTS (
                SELECT 1 FROM product_variant pv 
                WHERE pv.product_id = p.id AND pv.sku ILIKE :likePattern
              ) THEN 50
              ELSE 0
            END +
            CASE 
              WHEN p.description IS NOT NULL AND (p.description ILIKE :likePattern OR unaccent(p.description) ILIKE unaccent(:likePattern)) THEN 15
              ELSE 0
            END
          ) as relevance_score
        FROM product p
        WHERE p.status = 'published'
          AND p.deleted_at IS NULL
          AND (p.metadata IS NULL OR (p.metadata->>'is_cod_fee' IS DISTINCT FROM 'true' AND p.metadata->>'hidden' IS DISTINCT FROM 'true'))
          AND p.handle != 'kapida-odeme-hizmet-bedeli'
          AND NOT EXISTS (
            SELECT 1 FROM product_variant pv_cod 
            WHERE pv_cod.product_id = p.id AND pv_cod.sku = 'SERVICE-COD-FEE'
          )
          AND (
            p.title ILIKE :likePattern
            OR unaccent(p.title) ILIKE unaccent(:likePattern)
            OR unaccent(lower(p.title)) ILIKE :normalizedTurkish
            OR (p.subtitle IS NOT NULL AND (p.subtitle ILIKE :likePattern OR unaccent(p.subtitle) ILIKE unaccent(:likePattern)))
            OR (p.description IS NOT NULL AND (p.description ILIKE :likePattern OR unaccent(p.description) ILIKE unaccent(:likePattern)))
            OR similarity(p.title, :rawQ) > 0.15
            OR EXISTS (
              SELECT 1 FROM product_variant pv 
              WHERE pv.product_id = p.id AND pv.sku ILIKE :likePattern
            )
            OR EXISTS (
              SELECT 1 FROM product_category_product pcp
              JOIN product_category pc ON pc.id = pcp.product_category_id
              WHERE pcp.product_id = p.id AND (
                pc.name ILIKE :likePattern 
                OR unaccent(pc.name) ILIKE unaccent(:likePattern)
                OR unaccent(lower(pc.name)) ILIKE :normalizedTurkish
              )
            )
          )
        ORDER BY relevance_score DESC, p.created_at DESC
        LIMIT 200;
      `;

      const result = await pgConnection.raw(sql, {
        rawQ,
        likePattern,
        exactPattern,
        prefixPattern,
        normalizedTurkish,
      });

      const rows: RawProductMatch[] = result.rows || [];
      matchedProductIds = rows.map((r) => r.id);
      for (const row of rows) {
        relevanceMap.set(row.id, Number(row.relevance_score) || 0);
      }
    } catch (err: any) {
      // In case unaccent/pg_trgm are unavailable, fallback to standard LIKE query
      const fallbackSql = `
        SELECT p.id, 50 as relevance_score
        FROM product p
        WHERE p.status = 'published'
          AND p.deleted_at IS NULL
          AND (p.metadata IS NULL OR (p.metadata->>'is_cod_fee' IS DISTINCT FROM 'true' AND p.metadata->>'hidden' IS DISTINCT FROM 'true'))
          AND p.handle != 'kapida-odeme-hizmet-bedeli'
          AND NOT EXISTS (
            SELECT 1 FROM product_variant pv_cod 
            WHERE pv_cod.product_id = p.id AND pv_cod.sku = 'SERVICE-COD-FEE'
          )
          AND (
            p.title ILIKE :likePattern
            OR p.subtitle ILIKE :likePattern
            OR p.description ILIKE :likePattern
            OR EXISTS (
              SELECT 1 FROM product_variant pv 
              WHERE pv.product_id = p.id AND pv.sku ILIKE :likePattern
            )
          )
        LIMIT 200;
      `;
      try {
        const fallbackResult = await pgConnection.raw(fallbackSql, { likePattern });
        const rows: RawProductMatch[] = fallbackResult.rows || [];
        matchedProductIds = rows.map((r) => r.id);
        for (const row of rows) {
          relevanceMap.set(row.id, 50);
        }
      } catch {
        // Fallback failed
      }
    }
  }

  // If no products matched the text query, return empty early
  if (matchedProductIds.length === 0) {
    res.status(200).json({
      products: [],
      count: 0,
      limit,
      offset,
      query: rawQ,
    });
    return;
  }

  // 3. Resolve Turkey Region for Server-Authoritative Pricing
  let turkeyRegionId: string | null = null;
  try {
    const regionService = req.scope.resolve(Modules.REGION);
    const regions = await regionService.listRegions({ currency_code: "try" });
    if (regions && regions.length > 0) {
      turkeyRegionId = regions[0].id;
    }
  } catch {
    // fallback
  }

  // 4. Load full product data with calculated prices using Medusa Remote Query
  let products: any[] = [];
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "title",
        "subtitle",
        "description",
        "handle",
        "thumbnail",
        "status",
        "created_at",
        "metadata",
        "categories.id",
        "categories.name",
        "categories.handle",
        "collection.id",
        "collection.title",
        "collection.handle",
        "variants.id",
        "variants.title",
        "variants.sku",
        "variants.manage_inventory",
        "variants.inventory_quantity",
        "variants.calculated_price.*",
      ],
      filters: {
        id: matchedProductIds,
        status: "published",
      },
      context: turkeyRegionId
        ? {
            region_id: turkeyRegionId,
            currency_code: "try",
          }
        : undefined,
    });
    products = data || [];
  } catch {
    // If remote query fails, fallback to productService
    try {
      const productService = req.scope.resolve(Modules.PRODUCT);
      products = await productService.listProducts({ id: matchedProductIds });
    } catch {
      products = [];
    }
  }

  // 5. Apply Strict Filtering:
  // - Category filter
  // - Hidden product exclusion (double-check in memory)
  // - Stock filter (in_stock)
  // - Price range filter (min_price, max_price)
  const filtered = products.filter((p) => {
    // Never return hidden/COD service products
    if (
      p.metadata?.is_cod_fee === true ||
      p.metadata?.hidden === true ||
      p.handle === "kapida-odeme-hizmet-bedeli" ||
      p.variants?.some((v: any) => v.sku === "SERVICE-COD-FEE")
    ) {
      return false;
    }

    // Category filter
    if (categoryFilter) {
      const hasCategory = p.categories?.some(
        (c: any) => c.id === categoryFilter || c.handle === categoryFilter,
      );
      if (!hasCategory) return false;
    }

    // In-stock filter
    if (inStockOnly) {
      const hasStock = p.variants?.some((v: any) => {
        if (v.manage_inventory === false) return true;
        return (v.inventory_quantity ?? 0) > 0;
      });
      if (!hasStock) return false;
    }

    // Calculated price resolution
    const firstVariantPrice =
      p.variants?.[0]?.calculated_price?.calculated_amount ??
      p.variants?.[0]?.prices?.[0]?.amount ??
      null;

    if (firstVariantPrice !== null) {
      // In Medusa, calculated_amount for TRY is often in minor units (kuruş) or standard depending on setup
      // If amount > 1000 and min_price is around 100, normalize if needed or compare directly
      const priceVal = firstVariantPrice;
      if (minPrice !== null && priceVal < minPrice) return false;
      if (maxPrice !== null && priceVal > maxPrice) return false;
    }

    return true;
  });

  // 6. Sorting
  if (sort === "price_asc") {
    filtered.sort((a, b) => {
      const priceA = a.variants?.[0]?.calculated_price?.calculated_amount ?? 0;
      const priceB = b.variants?.[0]?.calculated_price?.calculated_amount ?? 0;
      return priceA - priceB;
    });
  } else if (sort === "price_desc") {
    filtered.sort((a, b) => {
      const priceA = a.variants?.[0]?.calculated_price?.calculated_amount ?? 0;
      const priceB = b.variants?.[0]?.calculated_price?.calculated_amount ?? 0;
      return priceB - priceA;
    });
  } else if (sort === "newest") {
    filtered.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  } else {
    // Default: Sort by relevance score
    filtered.sort((a, b) => {
      const scoreA = relevanceMap.get(a.id) ?? 0;
      const scoreB = relevanceMap.get(b.id) ?? 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  const totalMatching = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  res.status(200).json({
    products: paginated,
    count: totalMatching,
    limit,
    offset,
    query: rawQ,
  });
}
