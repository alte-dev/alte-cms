import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules, QueryContext } from "@medusajs/framework/utils";
import {
  validateSearchQuery,
  escapeLikeWildcards,
  normalizeTurkishText,
  checkSearchRateLimit,
} from "../../../utils/turkish-search";

interface RawProductMatch {
  id: string;
  relevance_score: number;
  total_count: number;
}

/**
 * GET /store/search
 * High-performance, Turkish-aware, PostgreSQL trigram & unaccent search API.
 * Rate limited to 60 req/min per IP.
 * Applies category, price, stock filters and sorting strictly in database query.
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

  // 2. Validate and Sanitize Search Query 'q' (optional when filters are provided)
  const qParam = req.query.q as string | undefined;
  const hasFilter =
    req.query.category !== undefined ||
    req.query.min_price !== undefined ||
    req.query.max_price !== undefined ||
    req.query.in_stock !== undefined ||
    req.query.sort !== undefined;

  const validation = validateSearchQuery(qParam, {
    allowEmpty: hasFilter || qParam === undefined,
  });
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const rawQ = validation.sanitized;
  const hasQ = rawQ.length > 0;
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

  if (!pgConnection || typeof pgConnection.raw !== "function") {
    console.error("[Search API] Veritabanı bağlantısı sağlanamadı (PG_CONNECTION eksik).");
    res.status(500).json({ error: "Veritabanı bağlantısı kurulamadı." });
    return;
  }

  // 3. Resolve Turkey Region for Server-Authoritative Pricing (Fail closed, no silent fallback)
  let turkeyRegionId: string | null = null;
  try {
    const regionService = req.scope.resolve(Modules.REGION);
    const regions = await regionService.listRegions({ currency_code: "try" });
    if (regions && regions.length > 0) {
      turkeyRegionId = regions[0].id;
    }
  } catch (err: any) {
    console.error("[Search API] Fiyat bağlamı çözülemedi:", err.message);
  }

  if (!turkeyRegionId) {
    console.error(
      "[Search API] Fiyat bağlamı çözülemedi: currency_code='try' olan bölge bulunamadı.",
    );
    res.status(500).json({ error: "Fiyat bağlamı çözülemedi." });
    return;
  }

  const escapedLike = escapeLikeWildcards(rawQ);
  const likePattern = `%${escapedLike}%`;
  const exactPattern = escapedLike;
  const prefixPattern = `${escapedLike}%`;
  const normalizedTurkish = `%${normalizeTurkishText(rawQ)}%`;

  let matchedProductIds: string[] = [];
  let totalCount = 0;

  try {
    // Primary SQL Query using pg_trgm & unaccent with Database-level filtering, sorting, and pagination
    // Explicit CASTs on all parameters prevent PostgreSQL 'could not determine data type of parameter $N' errors
    const sql = `
      SELECT 
        p.id,
        (
          CASE WHEN CAST(:hasQ AS boolean) = true THEN
            (
              CASE 
                WHEN p.title ILIKE CAST(:exactPattern AS text) THEN 100
                WHEN p.title ILIKE CAST(:prefixPattern AS text) THEN 80
                WHEN p.title ILIKE CAST(:likePattern AS text) THEN 60
                WHEN unaccent(p.title) ILIKE unaccent(CAST(:likePattern AS text)) THEN 50
                WHEN unaccent(lower(p.title)) ILIKE CAST(:normalizedTurkish AS text) THEN 45
                WHEN similarity(p.title, CAST(:rawQ AS text)) > 0.15 THEN (similarity(p.title, CAST(:rawQ AS text)) * 40)::int
                ELSE 0
              END +
              CASE 
                WHEN p.subtitle IS NOT NULL AND p.subtitle ILIKE CAST(:likePattern AS text) THEN 25
                WHEN p.subtitle IS NOT NULL AND unaccent(p.subtitle) ILIKE unaccent(CAST(:likePattern AS text)) THEN 20
                ELSE 0
              END +
              CASE 
                WHEN EXISTS (
                  SELECT 1 FROM product_variant pv 
                  WHERE pv.product_id = p.id AND pv.sku ILIKE CAST(:likePattern AS text) AND pv.deleted_at IS NULL
                ) THEN 50
                ELSE 0
              END +
              CASE 
                WHEN p.description IS NOT NULL AND (p.description ILIKE CAST(:likePattern AS text) OR unaccent(p.description) ILIKE unaccent(CAST(:likePattern AS text))) THEN 15
                ELSE 0
              END
            )
          ELSE 50
          END
        ) as relevance_score,
        COALESCE(pr_stat.min_price, 0) as min_price,
        COUNT(*) OVER() as total_count
      FROM product p
      LEFT JOIN LATERAL (
        SELECT 
          MIN(pr.amount) as min_price,
          MAX(pr.amount) as max_price
        FROM product_variant pv
        LEFT JOIN product_variant_price_set pvps ON pvps.variant_id = pv.id
        LEFT JOIN price pr ON pr.price_set_id = pvps.price_set_id 
          AND pr.currency_code = 'try' 
          AND pr.deleted_at IS NULL
        WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
      ) pr_stat ON true
      WHERE p.status = 'published'
        AND p.deleted_at IS NULL
        AND (p.metadata IS NULL OR (p.metadata->>'is_cod_fee' IS DISTINCT FROM 'true' AND p.metadata->>'hidden' IS DISTINCT FROM 'true'))
        AND p.handle != 'kapida-odeme-hizmet-bedeli'
        AND NOT EXISTS (
          SELECT 1 FROM product_variant pv_cod 
          WHERE pv_cod.product_id = p.id AND pv_cod.sku = 'SERVICE-COD-FEE'
        )
        -- Text Search Predicates
        AND (
          CAST(:hasQ AS boolean) = false
          OR p.title ILIKE CAST(:likePattern AS text)
          OR unaccent(p.title) ILIKE unaccent(CAST(:likePattern AS text))
          OR unaccent(lower(p.title)) ILIKE CAST(:normalizedTurkish AS text)
          OR (p.subtitle IS NOT NULL AND (p.subtitle ILIKE CAST(:likePattern AS text) OR unaccent(p.subtitle) ILIKE unaccent(CAST(:likePattern AS text))))
          OR (p.description IS NOT NULL AND (p.description ILIKE CAST(:likePattern AS text) OR unaccent(p.description) ILIKE unaccent(CAST(:likePattern AS text))))
          OR similarity(p.title, CAST(:rawQ AS text)) > 0.15
          OR EXISTS (
            SELECT 1 FROM product_variant pv 
            WHERE pv.product_id = p.id AND pv.sku ILIKE CAST(:likePattern AS text) AND pv.deleted_at IS NULL
          )
          OR EXISTS (
            SELECT 1 FROM product_category_product pcp
            JOIN product_category pc ON pc.id = pcp.product_category_id
            WHERE pcp.product_id = p.id AND (
              pc.name ILIKE CAST(:likePattern AS text) 
              OR unaccent(pc.name) ILIKE unaccent(CAST(:likePattern AS text))
              OR unaccent(lower(pc.name)) ILIKE CAST(:normalizedTurkish AS text)
            )
          )
        )
        -- Category Filter in SQL
        AND (
          CAST(:categoryFilter AS text) IS NULL 
          OR EXISTS (
            SELECT 1 FROM product_category_product pcp
            JOIN product_category pc ON pc.id = pcp.product_category_id
            WHERE pcp.product_id = p.id AND (
              pc.id = CAST(:categoryFilter AS text) 
              OR pc.handle = CAST(:categoryFilter AS text)
              OR pc.name ILIKE CAST(:categoryFilter AS text)
            )
          )
        )
        -- Price Range Filter in SQL
        AND (CAST(:minPrice AS numeric) IS NULL OR pr_stat.min_price >= CAST(:minPrice AS numeric))
        AND (CAST(:maxPrice AS numeric) IS NULL OR pr_stat.min_price <= CAST(:maxPrice AS numeric))
        -- Stock Filter in SQL
        AND (
          CAST(:inStockOnly AS boolean) = false 
          OR EXISTS (
            SELECT 1 FROM product_variant pv
            WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
              AND (
                pv.manage_inventory = false
                OR EXISTS (
                  SELECT 1 FROM product_variant_inventory_item pvii
                  JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
                  WHERE pvii.variant_id = pv.id AND (il.stocked_quantity - COALESCE(il.reserved_quantity, 0)) > 0
                )
                OR NOT EXISTS (
                  SELECT 1 FROM product_variant_inventory_item pvii
                  WHERE pvii.variant_id = pv.id
                )
              )
          )
        )
      ORDER BY 
        CASE WHEN CAST(:sort AS text) = 'price_asc' THEN pr_stat.min_price END ASC NULLS LAST,
        CASE WHEN CAST(:sort AS text) = 'price_desc' THEN pr_stat.min_price END DESC NULLS LAST,
        CASE WHEN CAST(:sort AS text) = 'newest' THEN p.created_at END DESC,
        relevance_score DESC,
        p.created_at DESC
      LIMIT CAST(:limit AS integer) OFFSET CAST(:offset AS integer);
    `;

    const result = await pgConnection.raw(sql, {
      hasQ,
      rawQ,
      likePattern,
      exactPattern,
      prefixPattern,
      normalizedTurkish,
      categoryFilter,
      inStockOnly,
      minPrice,
      maxPrice,
      sort,
      limit,
      offset,
    });

    const rows: RawProductMatch[] = result.rows || [];
    matchedProductIds = rows.map((r) => r.id);
    totalCount = rows.length > 0 ? Number(rows[0].total_count) || 0 : 0;
  } catch (err: any) {
    console.error("[Search API] Veritabanı sorgusu başarısız:", err?.message || err);
    res.status(500).json({ error: "Arama sorgusu yürütülemedi." });
    return;
  }

  // If no products matched the text query, return empty early
  if (matchedProductIds.length === 0) {
    res.status(200).json({
      products: [],
      count: totalCount,
      limit,
      offset,
      query: rawQ,
    });
    return;
  }

  // 4. Load full product data with calculated prices using Medusa Remote Query & QueryContext
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
      context: {
        variants: {
          calculated_price: QueryContext({
            region_id: turkeyRegionId,
            currency_code: "try",
          }),
        },
      },
    });
    products = data || [];
  } catch (err: any) {
    console.error("[Search API] query.graph hatası:", err.message);
    res.status(500).json({ error: "Arama işlemi sırasında bir hata oluştu." });
    return;
  }

  // Map products strictly preserving the SQL order, attaching summary calculated_price & stock
  const productMap = new Map<string, any>(products.map((p) => [p.id, p]));
  const orderedProducts = matchedProductIds
    .map((id) => productMap.get(id))
    .filter(Boolean)
    .map((p) => {
      let minPriceVal: number | null = null;
      for (const v of p.variants || []) {
        const amt = v.calculated_price?.calculated_amount ?? null;
        if (amt !== null) {
          minPriceVal = minPriceVal === null ? amt : Math.min(minPriceVal, amt);
        }
      }

      const inStock =
        p.variants?.some((v: any) => {
          if (v.manage_inventory === false) return true;
          return (v.inventory_quantity ?? 0) > 0;
        }) ?? true;

      return {
        ...p,
        calculated_price: minPriceVal,
        in_stock: inStock,
      };
    });

  res.status(200).json({
    products: orderedProducts,
    count: totalCount,
    limit,
    offset,
    query: rawQ,
  });
}
