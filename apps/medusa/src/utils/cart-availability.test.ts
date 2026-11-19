import { describe, expect, it, vi } from "vitest";
import {
  checkCartAvailability,
  evaluateCartItemsAvailability,
  formatCartAvailabilityError,
  isUnrecoverableCartCompletionError,
  type CartAvailabilityItemInput,
} from "./cart-availability";

describe("evaluateCartItemsAvailability", () => {
  it("returns no issues for published in-stock items", () => {
    const items: CartAvailabilityItemInput[] = [
      {
        id: "item_1",
        title: "Keten Koltuk",
        quantity: 2,
        variant_id: "var_1",
        variant: {
          id: "var_1",
          sku: "KETEN-01",
          manage_inventory: true,
          allow_backorder: false,
          deleted_at: null,
          product: {
            id: "prod_1",
            title: "Keten Koltuk",
            status: "published",
            deleted_at: null,
          },
        },
      },
    ];

    const issues = evaluateCartItemsAvailability(items, { var_1: { availability: 5 } });
    expect(issues).toEqual([]);
  });

  it("flags deleted variant (variant is null or has deleted_at)", () => {
    const items: CartAvailabilityItemInput[] = [
      {
        id: "item_null",
        title: "Silinmiş Ürün",
        quantity: 1,
        variant_id: "var_deleted",
        variant: null,
      },
      {
        id: "item_soft",
        title: "Soft Silinmiş Varyant",
        quantity: 1,
        variant_id: "var_soft",
        variant: {
          id: "var_soft",
          manage_inventory: false,
          allow_backorder: false,
          deleted_at: "2026-11-18T10:00:00Z",
          product: {
            id: "prod_1",
            title: "Soft Silinmiş",
            status: "published",
            deleted_at: null,
          },
        },
      },
    ];

    const issues = evaluateCartItemsAvailability(items, {});
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({
      lineItemId: "item_null",
      reason: "deleted",
      availableQuantity: 0,
    });
    expect(issues[1]).toMatchObject({
      lineItemId: "item_soft",
      reason: "deleted",
      availableQuantity: 0,
    });
  });

  it("flags deleted product (product is null or has deleted_at)", () => {
    const items: CartAvailabilityItemInput[] = [
      {
        id: "item_prod_null",
        title: "Ürünü Silinmiş",
        quantity: 1,
        variant_id: "var_1",
        variant: {
          id: "var_1",
          manage_inventory: false,
          allow_backorder: false,
          deleted_at: null,
          product: null,
        },
      },
    ];

    const issues = evaluateCartItemsAvailability(items, {});
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toBe("deleted");
  });

  it("flags unpublished product (status !== 'published')", () => {
    const items: CartAvailabilityItemInput[] = [
      {
        id: "item_draft",
        title: "Taslak Ürün",
        quantity: 1,
        variant_id: "var_draft",
        variant: {
          id: "var_draft",
          manage_inventory: true,
          allow_backorder: false,
          deleted_at: null,
          product: {
            id: "prod_draft",
            title: "Taslak Ürün",
            status: "draft",
            deleted_at: null,
          },
        },
      },
    ];

    const issues = evaluateCartItemsAvailability(items, { var_draft: { availability: 10 } });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      lineItemId: "item_draft",
      reason: "unpublished",
      productId: "prod_draft",
    });
  });

  it("flags insufficient stock when manage_inventory=true and allow_backorder=false", () => {
    const items: CartAvailabilityItemInput[] = [
      {
        id: "item_low",
        title: "Az Stoklu Ürün",
        quantity: 3,
        variant_id: "var_low",
        variant: {
          id: "var_low",
          manage_inventory: true,
          allow_backorder: false,
          deleted_at: null,
          product: {
            id: "prod_low",
            title: "Az Stoklu Ürün",
            status: "published",
            deleted_at: null,
          },
        },
      },
    ];

    const issues = evaluateCartItemsAvailability(items, { var_low: { availability: 2 } });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      lineItemId: "item_low",
      reason: "insufficient_stock",
      requestedQuantity: 3,
      availableQuantity: 2,
    });
  });

  it("allows items with allow_backorder=true or manage_inventory=false even when availability is 0", () => {
    const items: CartAvailabilityItemInput[] = [
      {
        id: "item_bo",
        title: "Ön Sipariş Ürün",
        quantity: 5,
        variant_id: "var_bo",
        variant: {
          id: "var_bo",
          manage_inventory: true,
          allow_backorder: true,
          deleted_at: null,
          product: {
            id: "prod_bo",
            title: "Ön Sipariş Ürün",
            status: "published",
            deleted_at: null,
          },
        },
      },
      {
        id: "item_unmanaged",
        title: "Stok Takipsiz",
        quantity: 10,
        variant_id: "var_unmanaged",
        variant: {
          id: "var_unmanaged",
          manage_inventory: false,
          allow_backorder: false,
          deleted_at: null,
          product: {
            id: "prod_unmanaged",
            title: "Stok Takipsiz",
            status: "published",
            deleted_at: null,
          },
        },
      },
    ];

    const issues = evaluateCartItemsAvailability(items, {
      var_bo: { availability: 0 },
      var_unmanaged: { availability: 0 },
    });
    expect(issues).toEqual([]);
  });

  it("skips COD service fee line items identified by SKU", () => {
    const items: CartAvailabilityItemInput[] = [
      {
        id: "item_cod",
        title: "Kapıda Ödeme Hizmet Bedeli",
        quantity: 1,
        variant_id: "var_cod",
        variant_sku: "SERVICE-COD-FEE",
        metadata: { is_cod_fee: true },
        variant: null,
      },
    ];

    const issues = evaluateCartItemsAvailability(items, {});
    expect(issues).toEqual([]);
  });

  it("does NOT allow spoofed metadata.is_cod_fee to bypass availability checks on regular products", () => {
    const items: CartAvailabilityItemInput[] = [
      {
        id: "item_spoof_unpub",
        title: "Taslak Ürün",
        quantity: 1,
        variant_id: "var_draft",
        variant_sku: "NORMAL-SKU-1",
        metadata: { is_cod_fee: true },
        variant: {
          id: "var_draft",
          sku: "NORMAL-SKU-1",
          manage_inventory: true,
          allow_backorder: false,
          deleted_at: null,
          product: {
            id: "prod_draft",
            title: "Taslak Ürün",
            status: "draft",
            deleted_at: null,
          },
        },
      },
      {
        id: "item_spoof_del",
        title: "Silinmiş Ürün",
        quantity: 1,
        variant_id: "var_del",
        variant_sku: "NORMAL-SKU-2",
        metadata: { is_cod_fee: true },
        variant: null,
      },
    ];

    const issues = evaluateCartItemsAvailability(items, { var_draft: { availability: 10 } });
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ lineItemId: "item_spoof_unpub", reason: "unpublished" });
    expect(issues[1]).toMatchObject({ lineItemId: "item_spoof_del", reason: "deleted" });
  });

  it("aggregates requested quantities across multiple line items sharing the same variant", () => {
    const sharedVariant = {
      id: "var_shared",
      sku: "SHARED-1",
      manage_inventory: true,
      allow_backorder: false,
      deleted_at: null,
      product: {
        id: "prod_shared",
        title: "Keten Yastık",
        status: "published",
        deleted_at: null,
      },
    };

    const items: CartAvailabilityItemInput[] = [
      {
        id: "item_a",
        title: "Keten Yastık",
        quantity: 2,
        variant_id: "var_shared",
        variant: sharedVariant,
      },
      {
        id: "item_b",
        title: "Keten Yastık",
        quantity: 2,
        variant_id: "var_shared",
        variant: sharedVariant,
      },
    ];

    const issues = evaluateCartItemsAvailability(items, { var_shared: { availability: 3 } });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      lineItemId: "item_b",
      variantId: "var_shared",
      reason: "insufficient_stock",
      requestedQuantity: 4,
      availableQuantity: 3,
    });
  });
});

describe("checkCartAvailability", () => {
  it("queries cart items and variant availability using Medusa query", async () => {
    const mockQuery = {
      graph: vi.fn().mockResolvedValue({
        data: [
          {
            id: "cart_1",
            sales_channel_id: "sc_1",
            items: [
              {
                id: "item_1",
                title: "Masa",
                quantity: 2,
                variant_id: "var_1",
                variant_sku: "MASA-1",
                metadata: {},
                variant: {
                  id: "var_1",
                  sku: "MASA-1",
                  manage_inventory: true,
                  allow_backorder: false,
                  deleted_at: null,
                  product: {
                    id: "prod_1",
                    title: "Masa",
                    status: "published",
                    deleted_at: null,
                  },
                },
              },
            ],
          },
        ],
      }),
    };
    const mockGetAvailability = vi.fn().mockResolvedValue({
      var_1: { availability: 1 },
    });

    const result = await checkCartAvailability(
      { query: mockQuery, getVariantAvailability: mockGetAvailability },
      "cart_1",
    );

    expect(result.cartFound).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].reason).toBe("insufficient_stock");
    expect(mockGetAvailability).toHaveBeenCalledWith(mockQuery, {
      variant_ids: ["var_1"],
      sales_channel_id: "sc_1",
    });
  });

  it("returns cartFound=false and valid=false when cart does not exist", async () => {
    const mockQuery = {
      graph: vi.fn().mockResolvedValue({ data: [] }),
    };

    const result = await checkCartAvailability(
      { query: mockQuery, getVariantAvailability: vi.fn() },
      "cart_missing",
    );

    expect(result).toEqual({
      cartFound: false,
      valid: false,
      issues: [],
    });
  });
});

describe("formatCartAvailabilityError & isUnrecoverableCartCompletionError", () => {
  it("formats clear Turkish error messages with machine codes", () => {
    const msg = formatCartAvailabilityError([
      {
        lineItemId: "item_1",
        variantId: "var_1",
        productId: "prod_1",
        title: "Keten Koltuk",
        reason: "unpublished",
        requestedQuantity: 1,
        availableQuantity: 0,
      },
    ]);

    expect(msg).toContain("PRODUCT_UNPUBLISHED");
    expect(msg).toContain("Keten Koltuk");
    expect(isUnrecoverableCartCompletionError(msg)).toBe(true);
  });

  it("recognizes inventory, deleted, and unpublished errors as unrecoverable", () => {
    expect(isUnrecoverableCartCompletionError("insufficient_inventory")).toBe(true);
    expect(isUnrecoverableCartCompletionError("Variant does not have a product")).toBe(true);
    expect(isUnrecoverableCartCompletionError("[PRODUCT_UNAVAILABLE] Ürün kaldırıldı")).toBe(true);
    expect(isUnrecoverableCartCompletionError("ECONNREFUSED 127.0.0.1:5432")).toBe(false);
  });
});
