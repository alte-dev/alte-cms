import { describe, expect, it, vi } from "vitest";
import { assignDefaultShippingProfileToProduct } from "../../../../utils/default-shipping-profile";
import { GET, POST } from "./route";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("Admin Shipping Profile Default Policy", () => {
  it("blocks editor on GET and shop-manager on POST (fail-closed)", async () => {
    const res1 = createMockRes();
    await GET({ user: { role: "editor" } } as any, res1);
    expect(res1.statusCode).toBe(403);

    const res2 = createMockRes();
    await POST({ user: { role: "shop-manager" }, body: {} } as any, res2);
    expect(res2.statusCode).toBe(403);
  });

  it("sets apply_to_all_products on chosen profile and backfills products without profile", async () => {
    const profiles = [
      { id: "sp_1", name: "Default", type: "default", metadata: {} },
      { id: "sp_2", name: "Express", type: "custom", metadata: { apply_to_all_products: true } },
    ];
    const missingProducts = [{ id: "prod_no_sp" }];
    const inserted: Array<{ product_id: string; shipping_profile_id: string }> = [];

    const mockPg: any = (table: string) => {
      if (table === "shipping_profile") {
        return {
          whereNull: () => ({
            orderBy: async () => profiles,
          }),
          where: ({ id }: { id: string }) => ({
            whereNull: () => ({
              first: async () => profiles.find((p) => p.id === id) || null,
            }),
            update: async ({ metadata }: { metadata: Record<string, unknown> }) => {
              const target = profiles.find((p) => p.id === id);
              if (target) target.metadata = metadata;
            },
          }),
        };
      }
      if (table === "product") {
        return {
          whereNull: () => ({
            whereNotExists: async () => missingProducts,
          }),
        };
      }
      if (table === "product_shipping_profile") {
        return {
          insert: async (row: any) => {
            inserted.push({
              product_id: row.product_id,
              shipping_profile_id: row.shipping_profile_id,
            });
          },
        };
      }
      return {};
    };
    mockPg.raw = vi.fn();

    const res = createMockRes();
    await POST(
      {
        user: { role: "super-admin" },
        body: { shipping_profile_id: "sp_1", apply_to_all_products: true, apply_to_existing: true },
        scope: { resolve: () => mockPg },
      } as any,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect((profiles[0].metadata as any).apply_to_all_products).toBe(true);
    expect((profiles[1].metadata as any).apply_to_all_products).toBe(false);
    expect(inserted).toEqual([{ product_id: "prod_no_sp", shipping_profile_id: "sp_1" }]);
  });

  it("assignDefaultShippingProfileToProduct assigns store-wide profile when product has none", async () => {
    const profiles = [
      { id: "sp_def", name: "Default", type: "default", metadata: {} },
      {
        id: "sp_all",
        name: "Storewide",
        type: "custom",
        metadata: { apply_to_all_products: true },
      },
    ];
    const inserted: Array<{ product_id: string; shipping_profile_id: string }> = [];

    const mockPg: any = (table: string) => {
      if (table === "product_shipping_profile") {
        return {
          where: () => ({
            whereNull: () => ({
              first: async () => null,
            }),
          }),
          insert: async (row: any) => {
            inserted.push({
              product_id: row.product_id,
              shipping_profile_id: row.shipping_profile_id,
            });
          },
        };
      }
      if (table === "shipping_profile") {
        return {
          whereNull: () => ({
            orderBy: async () => profiles,
          }),
        };
      }
      return {};
    };

    const assignedId = await assignDefaultShippingProfileToProduct(mockPg, "prod_new_1");
    expect(assignedId).toBe("sp_all");
    expect(inserted).toEqual([{ product_id: "prod_new_1", shipping_profile_id: "sp_all" }]);
  });
});
