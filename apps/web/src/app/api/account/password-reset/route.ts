import { NextResponse } from "next/server";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../lib/medusa/account";
import { extractClientIp, requireAccountOrigin } from "../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../_utils";

const resetRequestSchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi giriniz.").max(254),
});

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  try {
    const body = await req.json();
    const parsed = resetRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçerli bir e-posta adresi giriniz." },
        { status: 400 },
      );
    }

    const data = await medusaAccountFetch<{ ok: boolean; message: string }>(
      "/store/account/password-reset/request",
      {
        method: "POST",
        clientIp: extractClientIp(req),
        body: JSON.stringify({ email: parsed.data.email }),
      },
    );

    return NextResponse.json(data, { status: 202 });
  } catch (err) {
    return handleAccountApiError(err, "Şifre sıfırlama isteği gönderilemedi.");
  }
}
