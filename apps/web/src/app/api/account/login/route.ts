import { NextResponse } from "next/server";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../lib/medusa/account";
import { assignCartToCustomer } from "../../../../lib/medusa/cart";
import { getCartId, setCustomerSessionToken } from "../../../../lib/medusa/cookies";
import { extractClientIp, requireAccountOrigin } from "../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../_utils";

const loginBodySchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi giriniz.").max(254),
  password: z.string().min(1, "Parola zorunludur.").max(128),
});

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  try {
    const body = await req.json();
    const parsed = loginBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "E-posta veya parola hatalı." }, { status: 401 });
    }

    const data = await medusaAccountFetch<{ token: string; expires_at: string }>(
      "/store/account/login",
      {
        method: "POST",
        clientIp: extractClientIp(req),
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      },
    );

    await setCustomerSessionToken(data.token);

    // Attach existing guest cart to customer account if present (non-blocking)
    const cartId = await getCartId();
    if (cartId) {
      const attached = await assignCartToCustomer(cartId, data.token);
      if (!attached) {
        console.warn("[Account Login] Misafir sepeti hesaba bağlanamadı (sepet korundu).");
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccountApiError(err, "Giriş işlemi sırasında bir hata oluştu.");
  }
}
