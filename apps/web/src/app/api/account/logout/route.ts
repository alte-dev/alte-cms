import { NextResponse } from "next/server";
import { medusaAccountFetch } from "../../../../lib/medusa/account";
import {
  deleteCustomerSessionToken,
  getCustomerSessionToken,
} from "../../../../lib/medusa/cookies";
import { extractClientIp, requireAccountOrigin } from "../../../../lib/security/origin-guard";

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  const token = await getCustomerSessionToken();
  if (token) {
    try {
      await medusaAccountFetch("/store/account/logout", {
        method: "POST",
        clientIp: extractClientIp(req),
        customerToken: token,
      });
    } catch {
      // Even if Medusa fails or token already expired, delete cookie locally
    }
  }

  await deleteCustomerSessionToken();
  return NextResponse.json({ ok: true });
}
