import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata", "payment_collections.payments.*"],
      filters: { id },
    });

    const order = orders?.[0];
    if (!order) {
      return res.status(404).json({ error: "Sipariş bulunamadı." });
    }

    const currentMeta = order.metadata || {};

    // Idempotency: if already marked collected, return success immediately
    if (currentMeta.cod_collected === true) {
      return res.status(200).json({
        success: true,
        message: "Kapıda ödeme zaten daha önce tahsil edildi olarak işaretlenmiş (İdempotent).",
        cod_collected: true,
        cod_collected_at: currentMeta.cod_collected_at,
      });
    }

    const updatedMeta = {
      ...currentMeta,
      cod_collected: true,
      cod_collected_at: new Date().toISOString(),
      payment_status: "captured",
    };

    await pgConnection("order")
      .where({ id })
      .update({
        metadata: JSON.stringify(updatedMeta),
        updated_at: new Date(),
      });

    return res.status(200).json({
      success: true,
      message: "Kapıda ödeme başarıyla tahsil edildi olarak işaretlendi.",
      cod_collected: true,
      cod_collected_at: updatedMeta.cod_collected_at,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Kapıda ödeme durumu güncellenirken hata: ${err.message}`,
    });
  }
};
