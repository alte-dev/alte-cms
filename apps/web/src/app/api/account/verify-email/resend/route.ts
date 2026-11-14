import { NextResponse } from "next/server";
import { medusaAccountFetch } from "../../../../../lib/medusa/account";
import { getCustomerSessionToken } from "../../../../../lib/medusa/cookies";
import { extractClientIp, requireAccountOrigin } from "../../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../../_utils";

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const data = await medusaAccountFetch<{ ok: boolean; message?: string }>(
      "/store/account/verify-email/resend",
      {
        method: "POST",
        clientIp: extractClientIp(req),
        customerToken: token,
      },
    );
    return NextResponse.json(data, { status: 202 });
  } catch (err) {
    return handleAccountApiError(err, "Doğrulama e-postası gönderilemedi.");
  }
}
