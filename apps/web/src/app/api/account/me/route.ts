import { NextResponse } from "next/server";
import { CustomerProfile, medusaAccountFetch } from "../../../../lib/medusa/account";
import {
  deleteCustomerSessionToken,
  getCustomerSessionToken,
} from "../../../../lib/medusa/cookies";
import { handleAccountApiError } from "../_utils";

export async function GET() {
  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const data = await medusaAccountFetch<{ customer: CustomerProfile }>("/store/account/me", {
      customerToken: token,
    });
    return NextResponse.json({ customer: data.customer });
  } catch (err) {
    await deleteCustomerSessionToken().catch(() => null);
    return handleAccountApiError(err, "Oturum doğrulanamadı.");
  }
}
