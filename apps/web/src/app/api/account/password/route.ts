import { NextResponse } from "next/server";
import { validateCustomerPassword } from "@alte/shared";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../lib/medusa/account";
import { getCustomerSessionToken, setCustomerSessionToken } from "../../../../lib/medusa/cookies";
import { extractClientIp, requireAccountOrigin } from "../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../_utils";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mevcut parola zorunludur.").max(128),
  newPassword: z.string().min(1, "Yeni parola zorunludur.").max(128),
});

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Lütfen parola alanlarını kontrol ediniz." },
        { status: 400 },
      );
    }

    const pwCheck = validateCustomerPassword(parsed.data.newPassword);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }

    const data = await medusaAccountFetch<{
      ok: boolean;
      token: string;
      expires_at: string;
      message: string;
    }>("/store/account/password", {
      method: "POST",
      clientIp: extractClientIp(req),
      customerToken: token,
      body: JSON.stringify({
        current_password: parsed.data.currentPassword,
        new_password: parsed.data.newPassword,
      }),
    });

    if (data.token) {
      await setCustomerSessionToken(data.token);
    }

    return NextResponse.json({ ok: true, message: data.message });
  } catch (err) {
    return handleAccountApiError(err, "Parola değiştirilemedi.");
  }
}
