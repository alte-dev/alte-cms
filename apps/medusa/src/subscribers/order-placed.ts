import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework/subscribers";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  getOrCreateEmailSettings,
  OrderEmailPayload,
  sendEmailNotification,
} from "../services/email-service";

export default async function orderPlacedHandler({
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
    // 1. Fetch complete order data using Medusa v2 Remote Query
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "total",
        "subtotal",
        "shipping_total",
        "currency_code",
        "metadata",
        "items.*",
        "items.variant.*",
        "shipping_address.*",
        "payment_collections.payments.*",
      ],
      filters: { id: data.id },
    });

    const order = orders?.[0];
    if (!order) {
      logger.warn(`[Email Subscriber] Sipariş bulunamadı: ${data.id}`);
      return;
    }

    // 2. Parse details and format payload
    const displayId = order.display_id || order.id.slice(-6);
    const customerEmail = order.email;
    const shippingAddr = order.shipping_address || {};
    const customerName =
      [shippingAddr.first_name, shippingAddr.last_name].filter(Boolean).join(" ").trim() ||
      "Değerli Müşterimiz";

    // Detect payment method
    let paymentMethod = "Kredi / Banka Kartı";
    const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || [];
    const isCod =
      order.metadata?.payment_provider === "cod" ||
      order.metadata?.is_cod === true ||
      payments.some((p: any) => p.provider_id?.includes("cod"));

    if (isCod) {
      paymentMethod = "Kapıda Ödeme (Nakit / Kart)";
    }

    // Check for COD fee item
    let codFeeTRY = 0;
    const items = (order.items || [])
      .filter((it: any) => {
        if (
          it.metadata?.is_cod_fee === true ||
          it.variant?.sku === "SERVICE-COD-FEE" ||
          it.title?.includes("Kapıda Ödeme")
        ) {
          codFeeTRY = Number(it.unit_price || it.total || 0);
          return false; // Display COD fee as a distinct fee line, not as a cart merchandise item
        }
        return true;
      })
      .map((it: any) => ({
        title: it.title || "Ürün",
        variantTitle: it.variant_title || it.variant?.title,
        sku: it.variant_sku || it.variant?.sku,
        quantity: Number(it.quantity) || 1,
        unitPriceTRY: Number(it.unit_price) || 0,
        totalPriceTRY: Number(it.total || (it.unit_price || 0) * (it.quantity || 1)),
      }));

    const payload: OrderEmailPayload = {
      orderId: order.id,
      displayId,
      customerEmail,
      customerName,
      items,
      subtotalTRY: Number(order.subtotal || 0),
      shippingTRY: Number(order.shipping_total || 0),
      codFeeTRY: codFeeTRY > 0 ? codFeeTRY : undefined,
      totalTRY: Number(order.total || 0),
      paymentMethod,
      shippingAddress: {
        address1: shippingAddr.address_1 || "",
        city: shippingAddr.city || "",
        postalCode: shippingAddr.postal_code,
        province: shippingAddr.province,
      },
    };

    // 3. Send Customer Email
    if (customerEmail) {
      await sendEmailNotification(pgConnection, "order.placed_customer", customerEmail, payload);
    }

    // 4. Send Admin Email (if admin_notify_email is set)
    const settings = await getOrCreateEmailSettings(pgConnection);
    if (settings?.admin_notify_email) {
      await sendEmailNotification(
        pgConnection,
        "order.placed_admin",
        settings.admin_notify_email,
        payload,
      );
    }
  } catch (err: any) {
    logger.error(`[Email Subscriber] order.placed bildirim hatası (${data.id}): ${err.message}`);
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
