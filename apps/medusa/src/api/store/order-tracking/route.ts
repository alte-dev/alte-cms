import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { BruteForceGuard, FixedWindowRateLimiter } from "../../../utils/rate-limiter";
import { timingSafeEmailMatch } from "../../../utils/shipping-carriers";

// In-memory rate limiter structures:
// 1. IP rate limit: max 10 requests per minute
const ipTrackingLimiter = new FixedWindowRateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
});
// 2. Brute-force block: 5 failed attempts per IP + order -> 15 min block
const trackingBruteForceGuard = new BruteForceGuard({
  maxFailures: 5,
  blockDurationMs: 15 * 60_000,
});

function checkTrackingRateLimit(
  ip: string,
  orderNumber: string,
): { allowed: boolean; reason?: string } {
  const blockKey = `${ip}:${orderNumber.trim().toLowerCase()}`;
  const blockDecision = trackingBruteForceGuard.check(blockKey);
  if (!blockDecision.allowed) {
    return {
      allowed: false,
      reason: `Çok fazla hatalı deneme yapıldı. Güvenlik nedeniyle ${blockDecision.remainingMinutes} dakika sonra tekrar deneyiniz.`,
    };
  }

  const ipDecision = ipTrackingLimiter.consume(ip);
  if (!ipDecision.allowed) {
    return {
      allowed: false,
      reason: "Hız sınırı aşıldı. Lütfen dakikada en fazla 10 sorgulama yapınız.",
    };
  }

  return { allowed: true };
}

function recordFailedAttempt(ip: string, orderNumber: string) {
  const blockKey = `${ip}:${orderNumber.trim().toLowerCase()}`;
  trackingBruteForceGuard.recordFailure(blockKey);
}

const trackingRequestSchema = z.object({
  order_id_or_number: z.string().min(1, "Sipariş numarası zorunludur.").max(50),
  email: z.string().email("Geçerli bir e-posta adresi giriniz."),
});

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const clientIp = String(req.ip || req.headers["x-forwarded-for"] || "127.0.0.1")
    .split(",")[0]
    .trim();

  const UNIFORM_NOT_FOUND_MESSAGE = "Sipariş bulunamadı veya e-posta adresi eşleşmiyor.";

  const parseResult = trackingRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    const attemptedOrder =
      typeof (req.body as any)?.order_id_or_number === "string"
        ? (req.body as any).order_id_or_number
        : "unknown";
    recordFailedAttempt(clientIp, attemptedOrder);
    return res.status(404).json({ error: UNIFORM_NOT_FOUND_MESSAGE });
  }

  const { order_id_or_number, email } = parseResult.data;

  // Rate limit check
  const rateCheck = checkTrackingRateLimit(clientIp, order_id_or_number);
  if (!rateCheck.allowed) {
    return res.status(429).json({ error: rateCheck.reason });
  }

  const normalizedInput = order_id_or_number.replace(/^#/, "").trim();

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    // Lookup order by display_id or id
    let orderRow: any = null;

    if (/^\d+$/.test(normalizedInput)) {
      orderRow = await pgConnection("order")
        .where({ display_id: Number(normalizedInput) })
        .first();
    }

    if (!orderRow) {
      orderRow = await pgConnection("order").where({ id: normalizedInput }).first();
    }

    if (!orderRow) {
      recordFailedAttempt(clientIp, order_id_or_number);
      // Generic uniform message to prevent enumeration
      return res.status(404).json({ error: "Sipariş bulunamadı veya e-posta adresi eşleşmiyor." });
    }

    // Timing-safe email verification
    const orderEmail = orderRow.email || "";
    if (!timingSafeEmailMatch(orderEmail, email)) {
      recordFailedAttempt(clientIp, order_id_or_number);
      return res.status(404).json({ error: "Sipariş bulunamadı veya e-posta adresi eşleşmiyor." });
    }

    // Success: fetch line items using query graph
    const { data: fullOrders } = await query.graph({
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
        "items.title",
        "items.quantity",
        "items.unit_price",
        "items.metadata",
      ],
      filters: { id: orderRow.id },
    });

    const fullOrder = fullOrders?.[0] || orderRow;
    const meta = fullOrder.metadata || {};

    let codFeeTRY = 0;
    const items = (fullOrder.items || [])
      .filter((it: any) => {
        if (it.metadata?.is_cod_fee === true || it.title?.includes("Kapıda Ödeme")) {
          codFeeTRY = Number(it.unit_price || 0);
          return false;
        }
        return true;
      })
      .map((it: any) => ({
        title: it.title,
        quantity: it.quantity,
      }));

    // Strictly return only public non-PII order status information
    return res.status(200).json({
      order: {
        display_id: fullOrder.display_id || fullOrder.id.slice(-6),
        status: fullOrder.status,
        created_at: fullOrder.created_at,
        items,
        subtotal: Number(fullOrder.subtotal || 0),
        shipping_total: Number(fullOrder.shipping_total || 0),
        cod_fee: codFeeTRY > 0 ? codFeeTRY : undefined,
        total: Number(fullOrder.total || 0),
        carrier_name: meta.carrier_name || meta.carrier_id || null,
        tracking_code: meta.tracking_code || null,
        tracking_url: meta.tracking_url || null,
        shipped_at: meta.shipped_at || null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Sipariş sorgulanırken bir hata oluştu: ${err.message}`,
    });
  }
};
