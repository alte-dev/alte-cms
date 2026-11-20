import { NextResponse } from "next/server";
import { medusaFetch } from "../../../../lib/medusa/client";
import {
  deleteCartId,
  getCartId,
  getOrderConfirmation,
  setOrderConfirmation,
} from "../../../../lib/medusa/cookies";
import { extractClientIp } from "../../../../lib/security/origin-guard";

const CART_ID_REGEX = /^cart_[A-Za-z0-9_-]{6,64}$/;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cartId = (url.searchParams.get("cart_id") || "").trim();

    if (!cartId || !CART_ID_REGEX.test(cartId)) {
      return NextResponse.json({ error: "cart_id parametresi gereklidir." }, { status: 400 });
    }

    // SEC-001: Verify caller owns this cart_id via httpOnly session cookie (or already has signed order confirmation)
    const sessionCartId = await getCartId();
    if (!sessionCartId || sessionCartId !== cartId) {
      const existingOrderId = await getOrderConfirmation();
      if (existingOrderId) {
        return NextResponse.json({
          status: "completed",
          order_id: existingOrderId,
        });
      }
      return NextResponse.json(
        { error: "Bu sepet oturumuna erişim yetkiniz yok." },
        { status: 403 },
      );
    }

    const clientIp = extractClientIp(req);
    const internalSecret = process.env.INTERNAL_API_SECRET || "";
    const headers: Record<string, string> = {};
    if (internalSecret) {
      headers["x-alte-internal"] = internalSecret;
    }
    if (clientIp && clientIp !== "unknown") {
      headers["x-alte-client-ip"] = clientIp;
    }

    const data = await medusaFetch<{
      status: "pending" | "processing" | "completed" | "failed";
      order_id?: string;
      error?: string;
    }>(`/store/checkout-status?cart_id=${encodeURIComponent(cartId)}`, {
      cache: "no-store",
      headers,
    });

    if (data.status === "completed" && data.order_id) {
      await setOrderConfirmation(data.order_id);
      await deleteCartId();
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    // SEC-004: Do not falsely mark transient rate-limit (429) or 5xx polling errors as payment failure
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: unknown }).status)
        : 0;
    if (status === 429 || status >= 500) {
      return NextResponse.json({
        status: "pending",
        retryable: true,
      });
    }

    return NextResponse.json(
      {
        status: "pending",
        retryable: true,
      },
      { status: 503 },
    );
  }
}
