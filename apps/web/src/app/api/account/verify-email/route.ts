import { NextResponse } from "next/server";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../lib/medusa/account";
import { extractClientIp, requireAccountOrigin } from "../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../_utils";

const verifySchema = z.object({
  token: z.string().trim().min(10).max(256),
});

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Bağlantı geçersiz veya süresi dolmuş." }, { status: 400 });
    }

    const data = await medusaAccountFetch<{ ok: boolean; linked_orders: number; message: string }>(
      "/store/account/verify-email",
      {
        method: "POST",
        clientIp: extractClientIp(req),
        body: JSON.stringify({ token: parsed.data.token }),
      },
    );

    return NextResponse.json(data);
  } catch (err) {
    return handleAccountApiError(err, "E-posta doğrulanamadı.");
  }
}
