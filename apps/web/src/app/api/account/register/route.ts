import { NextResponse } from "next/server";
import { validateCustomerPassword } from "@alte/shared";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../lib/medusa/account";
import {
  getKvkkNoticeVersion,
  getMarketingConsentVersion,
} from "../../../../lib/payload/kvkk-version";
import { extractClientIp, requireAccountOrigin } from "../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../_utils";

const registerBodySchema = z.object({
  email: z.string().trim().email("Geçerli bir e-posta adresi giriniz.").max(254),
  password: z.string().min(1).max(128),
  firstName: z.string().trim().min(1, "Ad zorunludur.").max(100),
  lastName: z.string().trim().min(1, "Soyad zorunludur.").max(100),
  phone: z.string().trim().max(30).optional().default(""),
  kvkkNotice: z.literal(true, {
    message: "KVKK Aydınlatma Metnini onaylamanız zorunludur.",
  }),
  marketingConsent: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  try {
    const body = await req.json();
    const parsed = registerBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Lütfen form alanlarını kontrol ediniz." },
        { status: 400 },
      );
    }

    const pwCheck = validateCustomerPassword(parsed.data.password, parsed.data.email);
    if (!pwCheck.valid) {
      return NextResponse.json({ error: pwCheck.error }, { status: 400 });
    }

    const [kvkkVersion, marketingVersion] = await Promise.all([
      getKvkkNoticeVersion(),
      Promise.resolve(getMarketingConsentVersion()),
    ]);

    const data = await medusaAccountFetch<{ ok: boolean; message: string }>(
      "/store/account/register",
      {
        method: "POST",
        clientIp: extractClientIp(req),
        body: JSON.stringify({
          email: parsed.data.email,
          password: parsed.data.password,
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          phone: parsed.data.phone || null,
          kvkk_notice: true,
          kvkk_version: kvkkVersion,
          marketing_consent: parsed.data.marketingConsent,
          marketing_version: marketingVersion,
        }),
      },
    );

    return NextResponse.json(data, { status: 202 });
  } catch (err) {
    return handleAccountApiError(err, "Kayıt işlemi sırasında bir hata oluştu.");
  }
}
