import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * Endpoint for Storefront payment return polling.
 * Route: GET /store/checkout-status?cart_id=<cart_id>
 * Returns strictly status and completed orderId. Zero personal data.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartId = String(req.query.cart_id || "");

  if (!cartId) {
    return res.status(400).json({ error: "cart_id parametresi zorunludur." });
  }

  try {
    const cartService = req.scope.resolve(Modules.CART);
    const cart = await cartService.retrieveCart(cartId, {
      select: ["id", "completed_at", "metadata"],
    });

    if (!cart) {
      return res.status(404).json({ error: "Sepet bulunamadı." });
    }

    if (cart.completed_at) {
      let orderId = (cart.metadata as any)?.order_id || null;

      if (!orderId) {
        try {
          const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
          const { data: orders } = await query.graph({
            entity: "order",
            fields: ["id", "cart.id"],
          });
          const matched = orders?.find((o: any) => o.cart?.id === cartId);
          if (matched) {
            orderId = matched.id;
          }
        } catch {
          // fallback
        }
      }

      if (!orderId) {
        try {
          const orderService = req.scope.resolve(Modules.ORDER);
          const orders = await orderService.listOrders({});
          const matched = (orders as any[]).find(
            (o: any) => o.cart_id === cartId || o.metadata?.cart_id === cartId,
          );
          if (matched) {
            orderId = matched.id;
          }
        } catch {
          // fallback
        }
      }

      return res.status(200).json({
        completed: true,
        order_id: orderId,
        status: "completed",
      });
    }

    return res.status(200).json({
      completed: false,
      status: "pending",
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Durum sorgulanamadı: ${err.message}`,
    });
  }
};
