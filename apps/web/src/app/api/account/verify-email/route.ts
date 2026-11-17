import { NextResponse } from "next/server";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../lib/medusa/account";
import { setCustomerSessionToken } from "../../../../lib/medusa/cookies";
import { extractClientIp, requireAccountOrigin } from "../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../_utils";

const verifyOtpSchema = z.object({
  email: z.string().trim().email().max(254),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Doğrulama kodu 6 haneli olmalıdır."),
});

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  try {
    const body = await req.json();
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "E-posta adresi veya 6 haneli doğrulama kodu geçersiz." },
        { status: 400 },
      );
    }

    const data = await medusaAccountFetch<{
      ok: boolean;
      linked_orders: number;
      token?: string;
      expires_at?: string;
      message: string;
    }>("/store/account/verify-email", {
      method: "POST",
      clientIp: extractClientIp(req),
      body: JSON.stringify({ email: parsed.data.email, code: parsed.data.code }),
    });

    if (data.token) {
      await setCustomerSessionToken(data.token);
    }

    return NextResponse.json({
      ok: data.ok,
      linked_orders: data.linked_orders,
      authenticated: Boolean(data.token),
      message: data.message,
    });
  } catch (err) {
    return handleAccountApiError(err, "E-posta doğrulanamadı.");
  }
}
