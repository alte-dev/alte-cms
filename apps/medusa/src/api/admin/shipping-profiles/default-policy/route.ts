import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import {
  checkAdminOrShopManagerRole,
  checkAdminSettingsRole,
} from "../../../../utils/admin-role-guard";
import {
  backfillProductsToShippingProfile,
  type ShippingProfileRow,
} from "../../../../utils/default-shipping-profile";

const updatePolicySchema = z.object({
  shipping_profile_id: z.string().min(1, "Kargo profili seçiniz."),
  apply_to_all_products: z.boolean(),
  apply_to_existing: z.boolean().optional().default(false),
  overwrite_existing: z.boolean().optional().default(false),
});

function getPg(req: MedusaRequest) {
  return (
    req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
    req.scope.resolve("__pg_connection__")
  );
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!(await checkAdminOrShopManagerRole(req, res))) return;

  try {
    const pg = getPg(req);
    const profiles = (await pg("shipping_profile")
      .whereNull("deleted_at")
      .orderBy("created_at", "asc")) as ShippingProfileRow[];

    let missingCount = 0;
    try {
      const missingRes = await pg("product")
        .whereNull("deleted_at")
        .whereNotExists(function (this: any) {
          this.select("*")
            .from("product_shipping_profile")
            .whereRaw("product_shipping_profile.product_id = product.id")
            .whereNull("product_shipping_profile.deleted_at");
        })
        .count("id as cnt");
      missingCount = Number(missingRes?.[0]?.cnt || 0);
    } catch {
      missingCount = 0;
    }

    return res.status(200).json({
      profiles: profiles.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        apply_to_all_products: Boolean(p.metadata?.apply_to_all_products),
      })),
      products_without_profile_count: missingCount,
    });
  } catch (err: any) {
    console.error("[Shipping Profile Policy GET] Error:", err?.message || "unknown");
    return res.status(500).json({ error: "Kargo profilleri yüklenemedi." });
  }
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!(await checkAdminSettingsRole(req, res))) return;

  const parsed = updatePolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues.map((i) => i.message).join(", "),
    });
  }

  const { shipping_profile_id, apply_to_all_products, apply_to_existing, overwrite_existing } =
    parsed.data;

  try {
    const pg = getPg(req);
    const target = (await pg("shipping_profile")
      .where({ id: shipping_profile_id })
      .whereNull("deleted_at")
      .first()) as ShippingProfileRow | undefined;

    if (!target) {
      return res.status(404).json({ error: "Kargo profili bulunamadı." });
    }

    const allProfiles = (await pg("shipping_profile")
      .whereNull("deleted_at")
      .orderBy("created_at", "asc")) as ShippingProfileRow[];

    for (const p of allProfiles) {
      const shouldEnable = p.id === shipping_profile_id ? apply_to_all_products : false;
      const prevEnable = Boolean(p.metadata?.apply_to_all_products);
      if (p.id === shipping_profile_id || (apply_to_all_products && prevEnable)) {
        await pg("shipping_profile")
          .where({ id: p.id })
          .update({
            metadata: { ...(p.metadata || {}), apply_to_all_products: shouldEnable },
            updated_at: new Date(),
          });
      }
    }

    let updatedProductsCount = 0;
    if (apply_to_existing) {
      updatedProductsCount = await backfillProductsToShippingProfile(
        pg,
        shipping_profile_id,
        overwrite_existing,
      );
    }

    return res.status(200).json({
      success: true,
      shipping_profile_id,
      apply_to_all_products,
      updated_products_count: updatedProductsCount,
    });
  } catch (err: any) {
    console.error("[Shipping Profile Policy POST] Error:", err?.message || "unknown");
    return res.status(500).json({ error: "Kargo profili kuralı kaydedilemedi." });
  }
};
