import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework/subscribers";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { OrderEmailPayload, sendEmailNotification } from "../services/email-service";

export default async function orderCanceledHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  let pgConnection: any = null;

  try {
    pgConnection =
      container.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      container.resolve("__pg_connection__");
  } catch {
    // pg_connection
  }

  if (!pgConnection || !data?.id) return;

  try {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "total",
        "subtotal",
        "shipping_total",
        "shipping_address.*",
      ],
      filters: { id: data.id },
    });

    const order = orders?.[0];
    if (!order || !order.email) return;

    const displayId = order.display_id || order.id.slice(-6);
    const shippingAddr = order.shipping_address || {};
    const customerName =
      [shippingAddr.first_name, shippingAddr.last_name].filter(Boolean).join(" ").trim() ||
      "Değerli Müşterimiz";

    const payload: OrderEmailPayload = {
      orderId: order.id,
      displayId,
      customerEmail: order.email,
      customerName,
      items: [],
      subtotalTRY: Number(order.subtotal || 0),
      shippingTRY: Number(order.shipping_total || 0),
      totalTRY: Number(order.total || 0),
      paymentMethod: "",
      shippingAddress: {
        address1: shippingAddr.address_1 || "",
        city: shippingAddr.city || "",
      },
    };

    await sendEmailNotification(pgConnection, "order.canceled", order.email, payload);
  } catch (err: any) {
    logger.error(`[Email Subscriber] order.canceled bildirim hatası (${data.id}): ${err.message}`);
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
};
