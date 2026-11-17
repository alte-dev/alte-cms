import crypto from "crypto";

export interface ShippingProfileRow {
  id: string;
  name: string;
  type: string;
  metadata: Record<string, unknown> | null;
}

/**
 * Resolves the store-wide default shipping profile:
 * 1) Profile with metadata.apply_to_all_products === true
 * 2) Profile with type === "default"
 * 3) First active profile
 */
export async function resolveStorewideShippingProfile(
  pgConnection: any,
): Promise<ShippingProfileRow | null> {
  if (!pgConnection) return null;
  const profiles = (await pgConnection("shipping_profile")
    .whereNull("deleted_at")
    .orderBy("created_at", "asc")) as ShippingProfileRow[];

  if (!profiles || profiles.length === 0) return null;

  const storewide = profiles.find((p) => p.metadata?.apply_to_all_products === true);
  if (storewide) return storewide;

  const defaultType = profiles.find((p) => p.type === "default");
  return defaultType || profiles[0];
}

/**
 * Assigns the store-wide default shipping profile to `productId` if it currently has none.
 */
export async function assignDefaultShippingProfileToProduct(
  pgConnection: any,
  productId: string,
): Promise<string | null> {
  if (!pgConnection || !productId) return null;

  const existing = await pgConnection("product_shipping_profile")
    .where({ product_id: productId })
    .whereNull("deleted_at")
    .first();

  if (existing?.shipping_profile_id) {
    return existing.shipping_profile_id;
  }

  const profile = await resolveStorewideShippingProfile(pgConnection);
  if (!profile) return null;

  const linkId = `psp_${crypto.randomBytes(10).toString("hex")}`;
  await pgConnection("product_shipping_profile").insert({
    id: linkId,
    product_id: productId,
    shipping_profile_id: profile.id,
    created_at: new Date(),
    updated_at: new Date(),
  });

  return profile.id;
}

/**
 * Links products missing a shipping profile (or all products if `overwriteExisting` is true)
 * to the specified `shippingProfileId`.
 */
export async function backfillProductsToShippingProfile(
  pgConnection: any,
  shippingProfileId: string,
  overwriteExisting = false,
): Promise<number> {
  if (!pgConnection || !shippingProfileId) return 0;

  if (overwriteExisting) {
    const allProducts = await pgConnection("product").whereNull("deleted_at").select("id");
    let count = 0;
    for (const prod of allProducts) {
      const existing = await pgConnection("product_shipping_profile")
        .where({ product_id: prod.id })
        .whereNull("deleted_at")
        .first();
      if (existing) {
        if (existing.shipping_profile_id !== shippingProfileId) {
          await pgConnection("product_shipping_profile")
            .where({ id: existing.id })
            .update({ shipping_profile_id: shippingProfileId, updated_at: new Date() });
          count += 1;
        }
      } else {
        await pgConnection("product_shipping_profile").insert({
          id: `psp_${crypto.randomBytes(10).toString("hex")}`,
          product_id: prod.id,
          shipping_profile_id: shippingProfileId,
          created_at: new Date(),
          updated_at: new Date(),
        });
        count += 1;
      }
    }
    return count;
  }

  const missingProducts = await pgConnection("product")
    .whereNull("deleted_at")
    .whereNotExists(function (this: any) {
      this.select("*")
        .from("product_shipping_profile")
        .whereRaw("product_shipping_profile.product_id = product.id")
        .whereNull("product_shipping_profile.deleted_at");
    });

  let count = 0;
  for (const prod of missingProducts) {
    await pgConnection("product_shipping_profile").insert({
      id: `psp_${crypto.randomBytes(10).toString("hex")}`,
      product_id: prod.id,
      shipping_profile_id: shippingProfileId,
      created_at: new Date(),
      updated_at: new Date(),
    });
    count += 1;
  }
  return count;
}
