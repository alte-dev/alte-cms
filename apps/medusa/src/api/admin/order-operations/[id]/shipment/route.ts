import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { OrderEmailPayload, sendEmailNotification } from "../../../../../services/email-service";
import {
  buildTrackingUrl,
  SUPPORTED_CARRIERS,
  validateTrackingCode,
} from "../../../../../utils/shipping-carriers";

const shipmentSchema = z.object({
  carrier_id: z.string().min(1, "Kargo firması seçiniz."),
  tracking_code: z
    .string()
    .min(1, "Takip kodu giriniz.")
    .max(40, "Takip kodu en fazla 40 karakter olabilir.")
    .refine((v) => validateTrackingCode(v), {
      message: "Takip kodu yalnızca harf, rakam ve tire (-) içerebilir.",
    }),
  custom_url: z.string().url().optional().or(z.literal("")),
});

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  const parseResult = shipmentSchema.safeParse(req.body);

  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    return res.status(400).json({ error: errorMsg });
  }

  const { carrier_id, tracking_code, custom_url } = parseResult.data;

  let trackingUrl = "";
  try {
    trackingUrl = buildTrackingUrl(carrier_id, tracking_code, custom_url);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  const carrier = SUPPORTED_CARRIERS[carrier_id.toLowerCase()];
  const carrierName = carrier ? carrier.name : carrier_id;

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    // Fetch order
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "total",
        "subtotal",
        "shipping_total",
        "metadata",
        "items.*",
        "shipping_address.*",
      ],
      filters: { id },
    });

    const order = orders?.[0];
    if (!order) {
      return res.status(404).json({ error: "Sipariş bulunamadı." });
    }

    const currentMeta = order.metadata || {};
    const updatedMeta = {
      ...currentMeta,
      carrier_id,
      carrier_name: carrierName,
      tracking_code,
      tracking_url: trackingUrl,
      shipped_at: new Date().toISOString(),
      fulfillment_status: "shipped",
    };

    // Update order metadata in database
    await pgConnection("order")
      .where({ id })
      .update({
        metadata: JSON.stringify(updatedMeta),
        updated_at: new Date(),
      });

    // Send customer shipment notification (FAZ 6B)
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
        carrierName,
        trackingCode: tracking_code,
        trackingUrl,
      };

      await sendEmailNotification(pgConnection, "shipment.created", order.email, payload);
    }

    return res.status(200).json({
      success: true,
      message: "Kargo takip bilgileri kaydedildi ve müşteriye bilgilendirme e-postası gönderildi.",
      fulfillment: {
        carrier_id,
        carrier_name: carrierName,
        tracking_code,
        tracking_url: trackingUrl,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Kargo bilgisi güncellenirken hata oluştu: ${err.message}`,
    });
  }
};
