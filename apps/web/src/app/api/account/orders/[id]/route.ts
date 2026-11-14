import { NextResponse } from "next/server";
import { AccountOrderSummary } from "../../../../../lib/medusa/account";
import { MedusaApiError, medusaFetch } from "../../../../../lib/medusa/client";
import {
  deleteCustomerSessionToken,
  getCustomerSessionToken,
} from "../../../../../lib/medusa/cookies";
import { handleAccountApiError } from "../../_utils";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Sipariş bulunamadı." }, { status: 404 });
  }

  try {
    const fields =
      "id,display_id,status,fulfillment_status,payment_status,total,subtotal,shipping_total,currency_code,created_at,metadata,*items,*shipping_address";
    // Strictly omit x-alte-internal so Medusa enforces customer order ownership
    const data = await medusaFetch<{ order: AccountOrderSummary }>(
      `/store/orders/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return NextResponse.json({ order: data.order });
  } catch (err) {
    if (err instanceof MedusaApiError && err.status === 401) {
      await deleteCustomerSessionToken().catch(() => null);
    }
    return handleAccountApiError(err, "Sipariş bulunamadı.");
  }
}
