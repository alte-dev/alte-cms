import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

const CART_ID_REGEX = /^[a-zA-Z0-9_-]{3,128}$/;

/**
 * Endpoint for Storefront payment return polling.
 * Route: GET /store/checkout-status?cart_id=<cart_id>
 * Returns strictly status and completed orderId. Zero personal data.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartId = typeof req.query.cart_id === "string" ? req.query.cart_id.trim() : "";

  if (!cartId || !CART_ID_REGEX.test(cartId)) {
    return res.status(400).json({ error: "Geçerli bir cart_id parametresi zorunludur." });
  }

  try {
    const cartService = req.scope.resolve(Modules.CART);
    let cart: any = null;
    try {
      cart = await cartService.retrieveCart(cartId, {
        select: ["id", "completed_at", "metadata"],
      });
    } catch (retrieveErr: any) {
      const msg = String(retrieveErr?.message || "");
      if (retrieveErr?.type === "not_found" || /not found/i.test(msg)) {
        return res.status(404).json({ error: "Sepet bulunamadı." });
      }
      throw retrieveErr;
    }

    if (!cart) {
      return res.status(404).json({ error: "Sepet bulunamadı." });
    }

    if (cart.completed_at) {
      let orderId = (cart.metadata as any)?.order_id || null;

      if (!orderId) {
        try {
          const pgConnection =
            req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
            req.scope.resolve("__pg_connection__");
          if (typeof pgConnection === "function") {
            const linkRow = await pgConnection("order_cart")
              .where({ cart_id: cartId })
              .whereNull("deleted_at")
              .first();
            if (linkRow?.order_id) {
              orderId = linkRow.order_id;
            }
          }
        } catch {
          // filtered lookup unavailable
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
    console.error("[checkout-status] Durum sorgulama hatası:", err?.message || "unknown");
    return res.status(500).json({
      error: "Sipariş durumu şu anda sorgulanamıyor.",
    });
  }
};
