import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { assignDefaultShippingProfileToProduct } from "../utils/default-shipping-profile";

/**
 * Automatically links newly created products that have no shipping profile
 * to the store-wide default shipping profile (`apply_to_all_products: true`).
 */
export default async function productDefaultShippingProfileHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  if (!data?.id) return;

  try {
    const pg =
      container.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      container.resolve("__pg_connection__");
    await assignDefaultShippingProfileToProduct(pg, data.id);
  } catch (err: any) {
    console.error(
      `[Product Default Shipping Profile] Failed for ${data.id}:`,
      err?.message || "unknown",
    );
  }
}

export const config: SubscriberConfig = {
  event: "product.created",
};
