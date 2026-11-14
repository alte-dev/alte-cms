import { NextResponse } from "next/server";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../lib/medusa/account";
import { getCustomerSessionToken } from "../../../../lib/medusa/cookies";
import { requireAccountOrigin } from "../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../_utils";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Ad zorunludur.").max(100),
  lastName: z.string().trim().min(1, "Soyad zorunludur.").max(100),
  phone: z.string().trim().max(30).optional().default(""),
});

export async function PATCH(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Lütfen form alanlarını kontrol ediniz." },
        { status: 400 },
      );
    }

    const data = await medusaAccountFetch<{ customer: Record<string, unknown> }>(
      "/store/customers/me",
      {
        method: "POST",
        customerToken: token,
        body: JSON.stringify({
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          phone: parsed.data.phone || null,
        }),
      },
    );

    return NextResponse.json({ ok: true, customer: data.customer });
  } catch (err) {
    return handleAccountApiError(err, "Profil güncellenemedi.");
  }
}
