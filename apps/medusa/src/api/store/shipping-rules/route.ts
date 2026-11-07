import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

/**
 * Public Storefront endpoint to retrieve shipping options rules
 * (e.g. Free shipping threshold based on item_total >= X rule).
 * Protected by Store Publishable API Key.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT);

  try {
    const options = await fulfillmentService.listShippingOptions(
      {},
      { relations: ["rules", "type"] },
    );

    let freeShippingThreshold: number | null = null;

    for (const opt of options) {
      const rule = opt.rules?.find(
        (r: any) => r.attribute === "item_total" && (r.operator === "gte" || r.operator === "gt"),
      );
      if (rule && !isNaN(Number(rule.value))) {
        freeShippingThreshold = Number(rule.value);
        break;
      }
    }

    res.json({
      threshold: freeShippingThreshold,
      shipping_options: options.map((o: any) => ({
        id: o.id,
        name: o.name,
        price_type: o.price_type,
        rules: o.rules,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      message: `Failed to retrieve shipping rules: ${err.message}`,
    });
  }
}
