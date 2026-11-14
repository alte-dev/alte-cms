import { NextResponse } from "next/server";
import { validateCustomerPassword } from "@alte/shared";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../../lib/medusa/account";
import { extractClientIp, requireAccountOrigin } from "../../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../../_utils";

const confirmSchema = z.object({
  token: z.string().trim().min(10).max(2048),
  password: z.string().min(1).max(128),
});

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  try {
    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Şifre sıfırlama bağlantısı veya parola geçersiz." },
        { status: 400 },
      );
    }

    const pwCheck = validateCustomerPassword(parsed.data.password);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }

    const data = await medusaAccountFetch<{ ok: boolean; message: string }>(
      "/store/account/password-reset/confirm",
      {
        method: "POST",
        clientIp: extractClientIp(req),
        body: JSON.stringify({
          token: parsed.data.token,
          password: parsed.data.password,
        }),
      },
    );

    return NextResponse.json(data);
  } catch (err) {
    return handleAccountApiError(err, "Parola sıfırlanamadı.");
  }
}
