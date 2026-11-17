import { NextResponse } from "next/server";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../../lib/medusa/account";
import { getCustomerSessionToken } from "../../../../../lib/medusa/cookies";
import { extractClientIp, requireAccountOrigin } from "../../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../../_utils";

const resendSchema = z.object({
  email: z.string().trim().email().max(254).optional(),
});

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  const token = await getCustomerSessionToken();
  const rawBody = await req.json().catch(() => ({}));
  const parsed = resendSchema.safeParse(rawBody ?? {});

  if (!token && (!parsed.success || !parsed.data.email)) {
    return NextResponse.json(
      { error: "Oturum açmanız veya e-posta belirtmeniz gerekiyor." },
      { status: 401 },
    );
  }

  try {
    const data = await medusaAccountFetch<{ ok: boolean; message?: string }>(
      "/store/account/verify-email/resend",
      {
        method: "POST",
        clientIp: extractClientIp(req),
        ...(token ? { customerToken: token } : {}),
        body: JSON.stringify(
          parsed.success && parsed.data.email ? { email: parsed.data.email } : {},
        ),
      },
    );
    return NextResponse.json(data, { status: 202 });
  } catch (err) {
    return handleAccountApiError(err, "Doğrulama e-postası gönderilemedi.");
  }
}
