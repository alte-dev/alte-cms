import { NextResponse } from "next/server";
import { medusaFetch } from "@/lib/medusa/client";
import { deleteCartId, setOrderConfirmation } from "@/lib/medusa/cookies";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const cartId = url.searchParams.get("cart_id");

    if (!cartId) {
      return NextResponse.json({ error: "cart_id parametresi gereklidir." }, { status: 400 });
    }

    const data = await medusaFetch<{
      status: "pending" | "processing" | "completed" | "failed";
      order_id?: string;
      error?: string;
    }>(`/store/checkout-status?cart_id=${encodeURIComponent(cartId)}`, {
      cache: "no-store",
    });

    if (data.status === "completed" && data.order_id) {
      await setOrderConfirmation(data.order_id);
      await deleteCartId();
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "failed",
        error: err?.message || "Ödeme durumu sorgulanamadı.",
      },
      { status: 500 },
    );
  }
}
