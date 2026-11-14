import { NextResponse } from "next/server";
import { z } from "zod";
import { medusaAccountFetch } from "../../../../lib/medusa/account";
import {
  deleteCustomerSessionToken,
  getCustomerSessionToken,
} from "../../../../lib/medusa/cookies";
import { extractClientIp, requireAccountOrigin } from "../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../_utils";

const deleteSchema = z.object({
  password: z.string().min(1, "Parolanızı giriniz.").max(128),
  confirmation: z.literal("SİL", {
    message: 'Onay alanına büyük harflerle "SİL" yazmalısınız.',
  }),
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
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Doğrulama bilgileri eksik." },
        { status: 400 },
      );
    }

    const data = await medusaAccountFetch<{ ok: boolean; message: string }>(
      "/store/account/delete",
      {
        method: "POST",
        clientIp: extractClientIp(req),
        customerToken: token,
        body: JSON.stringify({
          password: parsed.data.password,
          confirmation: parsed.data.confirmation,
        }),
      },
    );

    await deleteCustomerSessionToken();
    return NextResponse.json(data);
  } catch (err) {
    return handleAccountApiError(err, "Hesap silme işlemi tamamlanamadı.");
  }
}
