import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { sanitizeCsvCell } from "../../../../utils/shipping-carriers";

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  // Role check: Only admin, super-admin, shop-manager
  const user = (req as any).user;
  const userRole = user?.role || "admin"; // Medusa authenticated admin user

  if (user && userRole !== "admin" && userRole !== "super-admin" && userRole !== "shop-manager") {
    return res
      .status(403)
      .json({ error: "Yetkisiz erişim: Bu işlem için muhasebe/yönetici yetkisi gereklidir." });
  }

  const { from, to } = req.query as { from?: string; to?: string };

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

    const filters: Record<string, any> = {};
    if (from || to) {
      filters.created_at = {};
      if (from) filters.created_at.$gte = new Date(from);
      if (to) filters.created_at.$lte = new Date(to);
    }

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "total",
        "subtotal",
        "shipping_total",
        "metadata",
        "created_at",
        "payment_collections.payments.*",
      ],
      filters,
      pagination: {
        take: 1000,
        order: { created_at: "DESC" },
      },
    });

    const headers = [
      "Siparis No",
      "Tarih",
      "Durum",
      "Odeme Yontemi",
      "Ara Toplam",
      "Kargo",
      "Kapida Odeme Bedeli",
      "Toplam (KDV Dahil)",
      "Kargo Firmasi",
      "Takip Kodu",
    ];

    const rows: string[] = [headers.map(sanitizeCsvCell).join(",")];

    for (const order of orders || []) {
      const meta = order.metadata || {};
      const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || [];

      const isCod =
        meta.payment_provider === "cod" ||
        meta.is_cod === true ||
        payments.some((p: any) => p.provider_id?.includes("cod"));

      const paymentMethod = isCod ? "Kapıda Ödeme" : "Kredi Kartı (PayTR)";
      const codFee = isCod && meta.cod_fee ? Number(meta.cod_fee) : 0;
      const dateStr = new Date(order.created_at).toISOString().split("T")[0];

      const row = [
        `#${order.display_id || order.id.slice(-6)}`,
        dateStr,
        order.status || "pending",
        paymentMethod,
        Number(order.subtotal || 0).toFixed(2),
        Number(order.shipping_total || 0).toFixed(2),
        codFee > 0 ? codFee.toFixed(2) : "0.00",
        Number(order.total || 0).toFixed(2),
        meta.carrier_name || meta.carrier_id || "-",
        meta.tracking_code || "-",
      ];

      rows.push(row.map(sanitizeCsvCell).join(","));
    }

    const csvContent = rows.join("\r\n");
    const today = new Date().toISOString().split("T")[0];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="siparisler-${today}.csv"`);

    return res.status(200).send(csvContent);
  } catch (err: any) {
    return res.status(500).json({
      error: `CSV dışa aktarımı başarısız: ${err.message}`,
    });
  }
};
