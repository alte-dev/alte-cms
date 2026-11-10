import { NextResponse } from "next/server";
import {
  addItemToCart,
  completeCart,
  getCart,
  getPaymentOptions,
  initiatePaytrPayment,
  isDevPaymentAllowed,
  removeCartItem,
  setCartShippingMethod,
  updateCart,
} from "../../../lib/medusa/cart";
import {
  deleteCartId,
  getCartId,
  getOrderConfirmation,
  setOrderConfirmation,
} from "../../../lib/medusa/cookies";
import { mapMedusaError } from "../../../lib/medusa/format";
import { StoreAddress } from "../../../lib/medusa/types";
import { CheckoutFormSchema } from "../../../lib/medusa/validation";

const inFlightCartCheckouts = new Set<string>();
const completedCartOrders = new Map<string, string>();

export async function POST(req: Request) {
  let lockedCartId: string | null = null;
  try {
    const existingOrderId = await getOrderConfirmation();

    const cartId = await getCartId();
    if (!cartId) {
      return NextResponse.json(
        {
          success: false,
          error: "Sepetiniz bulunamadı. Lütfen alışverişe baştan başlayınız.",
          redirectUrl: existingOrderId ? "/siparis-onay" : "/sepet",
        },
        { status: 400 },
      );
    }

    const cart = await getCart(cartId);
    if (!cart || !cart.items || cart.items.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Sepetiniz boş. Lütfen sepetinize ürün ekleyiniz.",
          redirectUrl: "/sepet",
        },
        { status: 400 },
      );
    }

    // Check if cart was already completed (idempotency / double-submit guard)
    if (cart.completed_at || completedCartOrders.has(cartId)) {
      const recordedOrderId = completedCartOrders.get(cartId) || existingOrderId || undefined;
      return NextResponse.json(
        {
          success: false,
          code: "CART_ALREADY_COMPLETED",
          error: "Bu sepet için sipariş zaten oluşturuldu.",
          orderId: recordedOrderId,
          redirectUrl: recordedOrderId ? "/siparis-onay" : undefined,
        },
        { status: 409 },
      );
    }

    const body = await req.json();
    const parsed = CheckoutFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Lütfen form alanlarını kontrol ediniz.",
          issues: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    // Concurrency & idempotency guard for parallel checkout submissions on the same cart
    if (inFlightCartCheckouts.has(cartId) || completedCartOrders.has(cartId)) {
      const recordedOrderId = completedCartOrders.get(cartId) || existingOrderId || undefined;
      return NextResponse.json(
        {
          success: false,
          code: "CART_ALREADY_COMPLETED",
          error: "Bu sepet için sipariş zaten oluşturuldu.",
          orderId: recordedOrderId,
          redirectUrl: recordedOrderId ? "/siparis-onay" : undefined,
        },
        { status: 409 },
      );
    }

    inFlightCartCheckouts.add(cartId);
    lockedCartId = cartId;

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
      paymentMethod,
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

    const paymentOptions = await getPaymentOptions();

    let effectivePaymentMethod = paymentMethod;
    if (!effectivePaymentMethod) {
      if (isDevPaymentAllowed()) {
        effectivePaymentMethod = "dev";
      } else if (paymentOptions.paytr.enabled) {
        effectivePaymentMethod = "paytr";
      } else if (paymentOptions.cod.enabled) {
        effectivePaymentMethod = "cod";
      } else {
        effectivePaymentMethod = "paytr";
      }
    }

    // Metadata payload (audit timestamps, invoice details, payment mode; STRICTLY NO TC Kimlik No)
    const metadata: Record<string, unknown> = {
      invoice_type: invoiceType,
      ...(invoiceType === "corporate"
        ? {
            company_name: companyName,
            tax_office: taxOffice,
            tax_number: taxNumber,
          }
        : {}),
      payment_method: effectivePaymentMethod,
      ...(effectivePaymentMethod === "cod"
        ? {
            cod_fee: paymentOptions.cod.fee,
            cod_fee_label: paymentOptions.cod.fee_label || "Kapıda Ödeme Hizmet Bedeli",
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

    // Handle COD Fee Line Item addition/removal on cart
    const existingCodFeeItem = cart.items?.find(
      (item) =>
        item.variant?.sku === "SERVICE-COD-FEE" ||
        item.metadata?.is_cod_fee === true ||
        (item as any).sku === "SERVICE-COD-FEE",
    );

    if (effectivePaymentMethod === "cod") {
      if (!paymentOptions.cod.enabled) {
        return NextResponse.json(
          {
            success: false,
            error: "Kapıda ödeme yöntemi şu anda aktif değildir.",
          },
          { status: 400 },
        );
      }

      // Validate cod_max_order_amount against PRODUCT ITEMS ONLY
      const productItemsTotal = (cart.items || [])
        .filter(
          (i) =>
            i.id !== existingCodFeeItem?.id &&
            !i.metadata?.is_cod_fee &&
            i.variant?.sku !== "SERVICE-COD-FEE",
        )
        .reduce((sum, item) => sum + (item.unit_price || 0) * item.quantity, 0);

      if (
        paymentOptions.cod.max_order_amount !== null &&
        paymentOptions.cod.max_order_amount !== undefined &&
        paymentOptions.cod.max_order_amount > 0 &&
        productItemsTotal > paymentOptions.cod.max_order_amount
      ) {
        return NextResponse.json(
          {
            success: false,
            error: `Kapıda ödeme yöntemi en fazla ${paymentOptions.cod.max_order_amount} TL tutarındaki ürün siparişleri için geçerlidir. Mevcut sepet ürün tutarınız: ${productItemsTotal} TL.`,
          },
          { status: 400 },
        );
      }

      // Add COD service fee line item if not already in cart
      if (!existingCodFeeItem && paymentOptions.cod.variant_id) {
        await addItemToCart(cart.id, paymentOptions.cod.variant_id, 1);
      }
    } else {
      // Switched away from COD: remove COD service fee line item immediately from server cart
      if (existingCodFeeItem) {
        await removeCartItem(cart.id, existingCodFeeItem.id);
      }
    }

    // 3. Handle payment method execution
    if (effectivePaymentMethod === "paytr") {
      if (!paymentOptions.paytr.enabled) {
        return NextResponse.json(
          {
            success: false,
            error: "PayTR ile kredi kartı ödeme yöntemi şu anda aktif değildir.",
          },
          { status: 400 },
        );
      }

      const paytrData = await initiatePaytrPayment(cart.id);
      return NextResponse.json({
        success: true,
        paymentMethod: "paytr",
        token: paytrData.token,
        iframeUrl: paytrData.iframeUrl,
        displayMode: paytrData.displayMode,
        cartId: cart.id,
      });
    }

    if (effectivePaymentMethod === "cod") {
      if (!paymentOptions.cod.enabled) {
        return NextResponse.json(
          {
            success: false,
            error: "Kapıda ödeme yöntemi şu anda aktif değildir.",
          },
          { status: 400 },
        );
      }

      const completionResult = await completeCart(cart.id, "pp_cod_cod");
      if (!completionResult.success || !completionResult.order) {
        const refreshedCart = await getCart(cart.id).catch(() => null);
        if (
          refreshedCart?.completed_at ||
          completedCartOrders.has(cart.id) ||
          /completed|already|conflict/i.test(completionResult.error || "")
        ) {
          return NextResponse.json(
            {
              success: false,
              code: "CART_ALREADY_COMPLETED",
              error: "Bu sepet için sipariş zaten oluşturuldu.",
            },
            { status: 409 },
          );
        }
        return NextResponse.json(
          {
            success: false,
            error: "Kapıda ödeme siparişi oluşturulamadı.",
          },
          { status: 400 },
        );
      }

      completedCartOrders.set(cart.id, completionResult.order.id);
      await setOrderConfirmation(completionResult.order.id);
      await deleteCartId();

      return NextResponse.json({
        success: true,
        paymentMethod: "cod",
        orderId: completionResult.order.id,
        redirectUrl: "/siparis-onay",
      });
    }

    if (effectivePaymentMethod === "dev") {
      if (!isDevPaymentAllowed()) {
        return NextResponse.json(
          {
            success: false,
            error: "Geliştirici sahte ödeme yöntemi üretim ortamında kullanılamaz.",
          },
          { status: 400 },
        );
      }

      const completionResult = await completeCart(cart.id, "pp_system_default");
      if (!completionResult.success || !completionResult.order) {
        const refreshedCart = await getCart(cart.id).catch(() => null);
        if (
          refreshedCart?.completed_at ||
          completedCartOrders.has(cart.id) ||
          /completed|already|conflict/i.test(completionResult.error || "")
        ) {
          return NextResponse.json(
            {
              success: false,
              code: "CART_ALREADY_COMPLETED",
              error: "Bu sepet için sipariş zaten oluşturuldu.",
            },
            { status: 409 },
          );
        }
        return NextResponse.json(
          {
            success: false,
            error: "Sipariş tamamlanırken bir hata oluştu.",
          },
          { status: 400 },
        );
      }

      completedCartOrders.set(cart.id, completionResult.order.id);
      await setOrderConfirmation(completionResult.order.id);
      await deleteCartId();

      return NextResponse.json({
        success: true,
        paymentMethod: "dev",
        orderId: completionResult.order.id,
        redirectUrl: "/siparis-onay",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Geçersiz ödeme yöntemi.",
      },
      { status: 400 },
    );
  } catch (err: any) {
    const errText = err?.message || String(err);
    if (/completed|already/i.test(errText)) {
      const existingOrderId = await getOrderConfirmation().catch(() => null);
      return NextResponse.json(
        {
          success: false,
          code: "CART_ALREADY_COMPLETED",
          error: "Bu sepet için sipariş zaten oluşturuldu.",
          orderId: existingOrderId || undefined,
          redirectUrl: existingOrderId ? "/siparis-onay" : undefined,
        },
        { status: 409 },
      );
    }

    // Never leak raw technical/stack errors to client
    const mapped = mapMedusaError(err);
    const isRaw =
      !mapped ||
      mapped.includes("at ") ||
      mapped.includes("Error:") ||
      mapped.includes("fetch failed");
    const userFriendly = isRaw
      ? "Sipariş işlenirken bir hata oluştu. Lütfen tekrar deneyiniz."
      : mapped;

    return NextResponse.json({ success: false, error: userFriendly }, { status: 400 });
  } finally {
    if (lockedCartId) {
      inFlightCartCheckouts.delete(lockedCartId);
    }
  }
}
