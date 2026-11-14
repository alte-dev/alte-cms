import { NextResponse } from "next/server";
import { AccountOrderSummary, medusaAccountFetch } from "../../../../lib/medusa/account";
import { getCustomerSessionToken } from "../../../../lib/medusa/cookies";
import { handleAccountApiError } from "../_utils";

export async function GET() {
  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const fields =
      "id,display_id,status,fulfillment_status,payment_status,total,subtotal,shipping_total,currency_code,created_at,metadata,*items";
    const data = await medusaAccountFetch<{ orders: AccountOrderSummary[] }>(
      `/store/orders?fields=${encodeURIComponent(fields)}&order=-created_at`,
      { customerToken: token },
    );
    return NextResponse.json({ orders: data.orders || [] });
  } catch (err) {
    return handleAccountApiError(err, "Siparişler alınamadı.");
  }
}
