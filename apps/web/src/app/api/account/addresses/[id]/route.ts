import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerAddress, medusaAccountFetch } from "../../../../../lib/medusa/account";
import { getCustomerSessionToken } from "../../../../../lib/medusa/cookies";
import { requireAccountOrigin } from "../../../../../lib/security/origin-guard";
import { handleAccountApiError } from "../../_utils";

const patchAddressSchema = z.object({
  addressName: z.string().trim().min(1).max(60).optional(),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  address1: z.string().trim().min(5).max(250).optional(),
  address2: z.string().trim().max(250).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  province: z.string().trim().min(2).max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  isDefaultShipping: z.boolean().optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Adres kimliği eksik." }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = patchAddressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Lütfen adres alanlarını kontrol ediniz." },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const payload: Record<string, unknown> = {};
    if (d.addressName !== undefined) payload.address_name = d.addressName;
    if (d.firstName !== undefined) payload.first_name = d.firstName;
    if (d.lastName !== undefined) payload.last_name = d.lastName;
    if (d.phone !== undefined) payload.phone = d.phone;
    if (d.address1 !== undefined) payload.address_1 = d.address1;
    if (d.address2 !== undefined) payload.address_2 = d.address2;
    if (d.city !== undefined) payload.city = d.city;
    if (d.province !== undefined) payload.province = d.province;
    if (d.postalCode !== undefined) payload.postal_code = d.postalCode;
    if (d.isDefaultShipping !== undefined) {
      payload.is_default_shipping = d.isDefaultShipping;
      payload.is_default_billing = d.isDefaultShipping;
    }

    const data = await medusaAccountFetch<{ customer: { addresses?: CustomerAddress[] } }>(
      `/store/customers/me/addresses/${encodeURIComponent(id)}`,
      {
        method: "POST",
        customerToken: token,
        body: JSON.stringify(payload),
      },
    );

    return NextResponse.json({ ok: true, addresses: data.customer?.addresses || [] });
  } catch (err) {
    return handleAccountApiError(err, "Adres güncellenemedi.");
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const originErr = requireAccountOrigin(req);
  if (originErr) return originErr;

  const token = await getCustomerSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Adres kimliği eksik." }, { status: 400 });
  }

  try {
    await medusaAccountFetch(`/store/customers/me/addresses/${encodeURIComponent(id)}`, {
      method: "DELETE",
      customerToken: token,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleAccountApiError(err, "Adres silinemedi.");
  }
}
