import { NextResponse } from "next/server";
import { z } from "zod";
import { extractClientIp, requireAccountOrigin } from "../../../lib/security/origin-guard";

const orderTrackingSchema = z.object({
  order_id_or_number: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(254),
});

export async function POST(req: Request) {
  const originDenied = requireAccountOrigin(req);
  if (originDenied) return originDenied;

  const body = await req.json().catch(() => null);
  const parsed = orderTrackingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Sipariş bulunamadı veya e-posta adresi eşleşmiyor." },
      { status: 404 },
    );
  }

  const medusaUrl = (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_URL ||
    "http://127.0.0.1:9000"
  ).replace(/\/+$/, "");
  const publishableKey =
    process.env.MEDUSA_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";
  const internalSecret = process.env.INTERNAL_API_SECRET || "";
  const clientIp = extractClientIp(req);

  try {
    const res = await fetch(`${medusaUrl}/store/order-tracking`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(publishableKey ? { "x-publishable-api-key": publishableKey } : {}),
        ...(internalSecret ? { "x-alte-internal": internalSecret } : {}),
        "x-alte-client-ip": clientIp,
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Sipariş bulunamadı veya e-posta adresi eşleşmiyor." },
        { status: res.status },
      );
    }

    return NextResponse.json({ order: data.order }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Sipariş sorgulanırken bir bağlantı hatası oluştu. Lütfen tekrar deneyiniz." },
      { status: 503 },
    );
  }
}
