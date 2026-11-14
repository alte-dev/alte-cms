import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerAddress, medusaAccountFetch } from "../../../../lib/medusa/account";
import { getCustomerSessionToken } from "../../../../lib/medusa/cookies";
import { requireAccountOrigin } from "../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../_utils";

const addressBodySchema = z.object({
  addressName: z.string().trim().min(1, "Adres başlığı zorunludur.").max(60),
  firstName: z.string().trim().min(1, "Ad zorunludur.").max(100),
  lastName: z.string().trim().min(1, "Soyad zorunludur.").max(100),
  phone: z.string().trim().max(30).optional().default(""),
  address1: z.string().trim().min(5, "Adres en az 5 karakter olmalıdır.").max(250),
  address2: z.string().trim().max(250).optional().default(""),
  city: z.string().trim().min(2, "Şehir zorunludur.").max(80),
  province: z.string().trim().min(2, "İlçe zorunludur.").max(80),
  postalCode: z.string().trim().max(20).optional().default(""),
  isDefaultShipping: z.boolean().optional().default(false),
});

export async function GET() {
  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const data = await medusaAccountFetch<{ addresses: CustomerAddress[] }>(
      "/store/customers/me/addresses",
      { customerToken: token },
    );
    return NextResponse.json({ addresses: data.addresses || [] });
  } catch (err) {
    return handleAccountApiError(err, "Adresler alınamadı.");
  }
}

export async function POST(req: Request) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = addressBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Lütfen adres alanlarını kontrol ediniz." },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const data = await medusaAccountFetch<{ customer: { addresses?: CustomerAddress[] } }>(
      "/store/customers/me/addresses",
      {
        method: "POST",
        customerToken: token,
        body: JSON.stringify({
          address_name: d.addressName,
          first_name: d.firstName,
          last_name: d.lastName,
          phone: d.phone || undefined,
          address_1: d.address1,
          address_2: d.address2 || undefined,
          city: d.city,
          province: d.province,
          postal_code: d.postalCode || undefined,
          country_code: "tr",
          is_default_shipping: d.isDefaultShipping,
          is_default_billing: d.isDefaultShipping,
        }),
      },
    );

    return NextResponse.json({ ok: true, addresses: data.customer?.addresses || [] }, { status: 201 });
  } catch (err) {
    return handleAccountApiError(err, "Adres eklenemedi.");
  }
}
