import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { checkAdminOrShopManagerRole } from "../../../../../utils/admin-role-guard";
import { updateOrderAtomically } from "../../../../../utils/order-metadata-tx";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!(await checkAdminOrShopManagerRole(req, res))) return;
  const { id } = req.params;

  try {
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    const txResult = await updateOrderAtomically(pgConnection, id, (lockedOrder) => {
      const currentMeta = lockedOrder.metadata || {};

      // Idempotency: if already marked collected, return success immediately
      if (currentMeta.cod_collected === true) {
        return {
          abort: {
            statusCode: 200,
            body: {
              success: true,
              message:
                "Kapıda ödeme zaten daha önce tahsil edildi olarak işaretlenmiş (İdempotent).",
              cod_collected: true,
              cod_collected_at: currentMeta.cod_collected_at,
            },
          },
        };
      }

      const collectedAt = new Date().toISOString();
      return {
        metadataPatch: {
          cod_collected: true,
          cod_collected_at: collectedAt,
          payment_status: "captured",
        },
        result: { cod_collected_at: collectedAt },
      };
    });

    if (!txResult.ok) {
      return res.status(txResult.statusCode).json(txResult.body);
    }

    return res.status(200).json({
      success: true,
      message: "Kapıda ödeme başarıyla tahsil edildi olarak işaretlendi.",
      cod_collected: true,
      cod_collected_at: txResult.result.cod_collected_at,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Kapıda ödeme durumu güncellenirken hata: ${err.message}`,
    });
  }
};
