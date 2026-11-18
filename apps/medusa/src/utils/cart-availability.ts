import { getVariantAvailability as medusaGetVariantAvailability } from "@medusajs/framework/utils";

export type CartAvailabilityIssueReason = "deleted" | "unpublished" | "insufficient_stock";

export interface CartItemAvailabilityIssue {
  lineItemId: string;
  variantId: string | null;
  productId: string | null;
  title: string;
  reason: CartAvailabilityIssueReason;
  requestedQuantity: number;
  availableQuantity: number;
}

export interface CartAvailabilityItemInput {
  id: string;
  title?: string | null;
  quantity: number;
  variant_id?: string | null;
  variant_sku?: string | null;
  metadata?: Record<string, unknown> | null;
  variant?: {
    id: string;
    sku?: string | null;
    manage_inventory?: boolean | null;
    allow_backorder?: boolean | null;
    deleted_at?: string | Date | null;
    product?: {
      id: string;
      title?: string | null;
      status?: string | null;
      deleted_at?: string | Date | null;
    } | null;
  } | null;
}

export type VariantAvailabilityMap = Record<string, { availability: number | null } | undefined>;

export interface CartAvailabilityResult {
  cartFound: boolean;
  valid: boolean;
  issues: CartItemAvailabilityIssue[];
}

export function isCodFeeCartItem(item: {
  variant_sku?: string | null;
  variant?: { sku?: string | null } | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  return Boolean(
    item.metadata?.is_cod_fee === true ||
      item.variant_sku === "SERVICE-COD-FEE" ||
      item.variant?.sku === "SERVICE-COD-FEE",
  );
}

/**
 * Evaluates cart line items against current variant/product existence, publish status, and stock availability.
 */
export function evaluateCartItemsAvailability(
  items: CartAvailabilityItemInput[],
  availabilityMap: VariantAvailabilityMap,
): CartItemAvailabilityIssue[] {
  const issues: CartItemAvailabilityIssue[] = [];

  for (const item of items) {
    if (isCodFeeCartItem(item)) {
      continue;
    }

    const title = String(item.variant?.product?.title || item.title || "Ürün").trim();
    const variant = item.variant;
    const product = variant?.product;

    if (!variant || variant.deleted_at || !product || product.deleted_at) {
      issues.push({
        lineItemId: item.id,
        variantId: item.variant_id ?? variant?.id ?? null,
        productId: product?.id ?? null,
        title,
        reason: "deleted",
        requestedQuantity: item.quantity,
        availableQuantity: 0,
      });
      continue;
    }

    if (product.status !== "published") {
      issues.push({
        lineItemId: item.id,
        variantId: variant.id,
        productId: product.id,
        title,
        reason: "unpublished",
        requestedQuantity: item.quantity,
        availableQuantity: 0,
      });
      continue;
    }

    if (variant.manage_inventory && !variant.allow_backorder) {
      const availableRaw = availabilityMap[variant.id]?.availability;
      const available =
        typeof availableRaw === "number" && Number.isFinite(availableRaw)
          ? Math.max(0, availableRaw)
          : 0;

      if (available < item.quantity) {
        issues.push({
          lineItemId: item.id,
          variantId: variant.id,
          productId: product.id,
          title,
          reason: "insufficient_stock",
          requestedQuantity: item.quantity,
          availableQuantity: available,
        });
      }
    }
  }

  return issues;
}

export interface CartAvailabilityQuery {
  graph: (args: {
    entity: string;
    fields: string[];
    filters: Record<string, unknown>;
  }) => Promise<{ data: any[] }>;
}

export interface CartAvailabilityDeps {
  query: CartAvailabilityQuery;
  getVariantAvailability?: typeof medusaGetVariantAvailability;
}

/**
 * Fetches cart line items + current variant/product/inventory state from Medusa Query
 * and returns availability issues.
 */
export async function checkCartAvailability(
  deps: CartAvailabilityDeps,
  cartId: string,
): Promise<CartAvailabilityResult> {
  const { data: carts } = await deps.query.graph({
    entity: "cart",
    fields: [
      "id",
      "sales_channel_id",
      "items.id",
      "items.title",
      "items.quantity",
      "items.variant_id",
      "items.variant_sku",
      "items.metadata",
      "items.variant.id",
      "items.variant.sku",
      "items.variant.manage_inventory",
      "items.variant.allow_backorder",
      "items.variant.deleted_at",
      "items.variant.product.id",
      "items.variant.product.title",
      "items.variant.product.status",
      "items.variant.product.deleted_at",
    ],
    filters: { id: cartId },
  });

  const cart = carts?.[0];
  if (!cart) {
    return { cartFound: false, valid: false, issues: [] };
  }

  const items: CartAvailabilityItemInput[] = Array.isArray(cart.items) ? cart.items : [];
  const variantIds = Array.from(
    new Set(
      items
        .filter((item) => !isCodFeeCartItem(item) && item.variant && !item.variant.deleted_at)
        .map((item) => item.variant?.id || item.variant_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  let availabilityMap: VariantAvailabilityMap = {};
  if (variantIds.length > 0 && cart.sales_channel_id) {
    const getAvailability = deps.getVariantAvailability ?? medusaGetVariantAvailability;
    availabilityMap = await getAvailability(deps.query as any, {
      variant_ids: variantIds,
      sales_channel_id: cart.sales_channel_id,
    });
  }

  const issues = evaluateCartItemsAvailability(items, availabilityMap);
  return {
    cartFound: true,
    valid: issues.length === 0,
    issues,
  };
}

export function formatCartAvailabilityError(issues: CartItemAvailabilityIssue[]): string {
  if (!issues.length) {
    return "[PRODUCT_UNAVAILABLE] Sepetinizdeki ürünlerden biri şu anda satın alınamıyor.";
  }

  const first = issues[0];
  if (first.reason === "deleted") {
    return `[PRODUCT_UNAVAILABLE] "${first.title}" ürünü satıştan kaldırıldığı için sipariş verilemiyor. Lütfen sepetinizden çıkarın.`;
  }
  if (first.reason === "unpublished") {
    return `[PRODUCT_UNPUBLISHED] "${first.title}" ürünü şu anda yayında olmadığı için sipariş verilemiyor. Lütfen sepetinizden çıkarın.`;
  }
  if (first.availableQuantity <= 0) {
    return `[INSUFFICIENT_STOCK] "${first.title}" ürününün stoğu tükendiği için sipariş verilemiyor. Lütfen sepetinizden çıkarın.`;
  }
  return `[INSUFFICIENT_STOCK] "${first.title}" ürünü için stokta yalnızca ${first.availableQuantity} adet kaldı (sepetinizde ${first.requestedQuantity} adet var).`;
}

/**
 * Returns true when a cart completion error represents an unrecoverable business state
 * (out of stock, product unpublished, or product/variant deleted) rather than a transient infra failure.
 */
export function isUnrecoverableCartCompletionError(errorMessage: string): boolean {
  return /inventory|stock|insufficient|unpublished|not published|deleted|does not have a product|PRODUCT_UNAVAILABLE|PRODUCT_UNPUBLISHED|INSUFFICIENT_STOCK/i.test(
    errorMessage,
  );
}
