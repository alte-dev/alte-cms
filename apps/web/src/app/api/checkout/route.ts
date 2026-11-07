import { NextResponse } from "next/server";
import {
  completeCart,
  getCart,
  isDevPaymentAllowed,
  setCartShippingMethod,
  updateCart,
} from "../../../lib/medusa/cart";
import { deleteCartId, getCartId, setOrderConfirmation } from "../../../lib/medusa/cookies";
import { mapMedusaError } from "../../../lib/medusa/format";
import { StoreAddress } from "../../../lib/medusa/types";
import { CheckoutFormSchema } from "../../../lib/medusa/validation";

export async function POST(req: Request) {
  try {
    const cartId = await getCartId();
    if (!cartId) {
      return NextResponse.json(
        { error: "Sepetiniz bulunamadı. Lütfen alışverişe baştan başlayınız." },
        { status: 400 },
      );
    }

    const cart = await getCart(cartId);
    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        { error: "Sepetiniz boş. Lütfen sepetinize ürün ekleyiniz." },
        { status: 400 },
      );
    }

    const body = await req.json();
    const parsed = CheckoutFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Lütfen form alanlarını kontrol ediniz.",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const {
      email,
      phone,
      deliveryAddress,
      sameAsDelivery,
      billingAddress,
      invoiceType,
      companyName,
      taxOffice,
      taxNumber,
      shippingOptionId,
    } = parsed.data;

    // Build shipping address payload
    const shippingAddressPayload: Partial<StoreAddress> = {
      first_name: deliveryAddress.firstName,
      last_name: deliveryAddress.lastName,
      phone,
      address_1: deliveryAddress.addressLine1,
      address_2: deliveryAddress.addressLine2 || "",
      city: deliveryAddress.city,
      province: deliveryAddress.district,
      postal_code: deliveryAddress.postalCode || "",
      country_code: "tr",
    };

    // Build billing address payload
    const billingAddressPayload: Partial<StoreAddress> = sameAsDelivery
      ? shippingAddressPayload
      : {
          first_name: billingAddress?.firstName || deliveryAddress.firstName,
          last_name: billingAddress?.lastName || deliveryAddress.lastName,
          phone,
          address_1: billingAddress?.addressLine1 || "",
          address_2: billingAddress?.addressLine2 || "",
          city: billingAddress?.city || "",
          province: billingAddress?.district || "",
          postal_code: billingAddress?.postalCode || "",
          country_code: "tr",
        };

    // Metadata payload (audit timestamps, invoice details; STRICTLY NO TC Kimlik No)
    const metadata: Record<string, unknown> = {
      invoice_type: invoiceType,
      ...(invoiceType === "corporate"
        ? {
            company_name: companyName,
            tax_office: taxOffice,
            tax_number: taxNumber,
          }
        : {}),
      distance_sales_contract_consent_at: new Date().toISOString(),
      kvkk_consent_at: new Date().toISOString(),
    };

    // 1. Update cart with email, addresses, metadata
    await updateCart(cart.id, {
      email,
      shipping_address: shippingAddressPayload,
      billing_address: billingAddressPayload,
      metadata,
    });

    // 2. Assign selected shipping option
    await setCartShippingMethod(cart.id, shippingOptionId);

    // 3. Security gate: check development dummy payment allowance
    const simulateNoDevPayment =
      process.env.NODE_ENV !== "production" &&
      req.headers.get("x-simulate-no-dev-payment") === "true";

    if (!isDevPaymentAllowed() || simulateNoDevPayment) {
      return NextResponse.json(
        {
          success: false,
          error: "Ödeme yöntemi henüz yapılandırılmadı.",
        },
        { status: 400 },
      );
    }

    // 4. Complete order via Medusa workflow
    const completionResult = await completeCart(cart.id);
    if (!completionResult.success || !completionResult.order) {
      return NextResponse.json(
        {
          success: false,
          error: completionResult.error || "Sipariş tamamlanırken bir hata oluştu.",
        },
        { status: 400 },
      );
    }

    // 5. Success: store order ID in short-lived httpOnly cookie, clear active cart
    await setOrderConfirmation(completionResult.order.id);
    await deleteCartId();

    return NextResponse.json({
      success: true,
      orderId: completionResult.order.id,
      redirectUrl: "/siparis-onay",
    });
  } catch (err: any) {
    const message = mapMedusaError(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
