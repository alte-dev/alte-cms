import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { OrderEmailPayload, sendEmailNotification } from "../../../../../services/email-service";

const cancelSchema = z.object({
  reason: z.string().optional(),
});

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  const parseResult = cancelSchema.safeParse(req.body);
  const cancelReason = parseResult.success
    ? parseResult.data.reason || "Yönetici tarafından iptal edildi"
    : "İptal";

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "email",
        "total",
        "subtotal",
        "shipping_total",
        "metadata",
        "shipping_address.*",
        "payment_collections.payments.*",
      ],
      filters: { id },
    });

    const order = orders?.[0];
    if (!order) {
      return res.status(404).json({ error: "Sipariş bulunamadı." });
    }

    if (order.status === "canceled") {
      return res.status(200).json({
        success: true,
        message: "Sipariş zaten iptal edilmiş durumdadır.",
      });
    }

    const currentMeta = order.metadata || {};

    // 1. Guard: If order is already shipped, reject cancellation
    if (
      currentMeta.tracking_code ||
      currentMeta.fulfillment_status === "shipped" ||
      order.status === "completed"
    ) {
      return res.status(400).json({
        error: "Kargoya verilmiş siparişler iptal edilemez. Lütfen iade sürecini başlatınız.",
      });
    }

    // 2. Check payment method: if paid by Card (PayTR), mark as needs_manual_refund
    const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || [];
    const isPaytr =
      currentMeta.payment_provider === "paytr" ||
      payments.some((p: any) => p.provider_id?.includes("paytr"));

    const needsManualRefund = isPaytr && Number(order.total) > 0;

    const updatedMeta = {
      ...currentMeta,
      canceled_at: new Date().toISOString(),
      cancel_reason: cancelReason,
      needs_manual_refund: needsManualRefund,
      manual_refund_amount: needsManualRefund ? Number(order.total) : 0,
      manual_refund_reason: needsManualRefund
        ? `Sipariş iptali (#${order.display_id || order.id}): ${cancelReason}`
        : undefined,
    };

    // Update order status to canceled
    await pgConnection("order")
      .where({ id })
      .update({
        status: "canceled",
        metadata: JSON.stringify(updatedMeta),
        updated_at: new Date(),
      });

    // 3. Send order.canceled email notification to customer (FAZ 6B)
    if (order.email) {
      const payload: OrderEmailPayload = {
        orderId: order.id,
        displayId: order.display_id || order.id.slice(-6),
        customerEmail: order.email,
        customerName:
          [order.shipping_address?.first_name, order.shipping_address?.last_name]
            .filter(Boolean)
            .join(" ") || "Değerli Müşterimiz",
        items: [],
        subtotalTRY: Number(order.subtotal || 0),
        shippingTRY: Number(order.shipping_total || 0),
        totalTRY: Number(order.total || 0),
        paymentMethod: "",
        shippingAddress: {
          address1: order.shipping_address?.address_1 || "",
          city: order.shipping_address?.city || "",
        },
        cancelReason,
      };

      await sendEmailNotification(pgConnection, "order.canceled", order.email, payload);
    }

    let warningMessage = "";
    if (needsManualRefund) {
      warningMessage = ` DİKKAT: Kredi kartı ile tahsil edilen ${Number(order.total).toFixed(2)} TL tutarındaki ödeme otomatik olarak iade edilmemiştir. Lütfen PayTR mağaza paneli üzerinden elle iade işlemini gerçekleştiriniz.`;
    }

    return res.status(200).json({
      success: true,
      message: `Sipariş başarıyla iptal edildi.${warningMessage}`,
      needs_manual_refund: needsManualRefund,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Sipariş iptal edilirken hata oluştu: ${err.message}`,
    });
  }
};
