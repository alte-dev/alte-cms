import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export interface ManualRefundDto {
  id: string;
  cart_id: string | null;
  amount: number;
  currency: string;
  status: string;
  reason: string;
  created_at: string;
}

/**
 * GET /admin/payment-settings/manual-refunds
 * Returns payment sessions that succeeded at PayTR but require manual merchant refund
 * due to unrecoverable cart completion errors (e.g. out of inventory).
 * STRICT PRIVACY: Zero PII (no customer name, email, phone, or address).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const refunds: ManualRefundDto[] = [];

  try {
    let pgConnection: any = null;
    if (req.scope?.hasRegistration?.(ContainerRegistrationKeys.PG_CONNECTION)) {
      pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
    } else if (req.scope?.hasRegistration?.("__pg_connection__")) {
      pgConnection = req.scope.resolve("__pg_connection__");
    }

    if (pgConnection) {
      const rows = await pgConnection("payment_session")
        .whereRaw("(data->>'needs_manual_refund')::boolean = true")
        .whereNull("deleted_at")
        .select("id", "amount", "currency_code", "status", "data", "created_at")
        .orderBy("created_at", "desc");

      for (const row of rows) {
        refunds.push({
          id: row.id,
          cart_id: row.data?.cart_id || null,
          amount: Number(row.amount || 0),
          currency: row.currency_code || "TRY",
          status: row.status || "pending",
          reason: row.data?.manual_refund_reason || "Bilinmeyen kurtarılamaz hata",
          created_at: row.created_at
            ? new Date(row.created_at).toISOString()
            : new Date().toISOString(),
        });
      }
    }
  } catch (err: any) {
    console.error("[Manual Refunds API] Error fetching manual refund sessions:", err.message);
  }

  res.status(200).json({
    refunds,
    count: refunds.length,
  });
}
