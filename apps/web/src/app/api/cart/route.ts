import { NextResponse } from "next/server";
import {
  addItemToCart,
  applyPromotionCode,
  getCart,
  getOrCreateCart,
  getShippingRules,
  removeCartItem,
  removePromotionCode,
  updateCartItem,
} from "../../../lib/medusa/cart";
import { getCartId } from "../../../lib/medusa/cookies";
import { calculateFreeShippingProgress, mapMedusaError } from "../../../lib/medusa/format";
import {
  AddToCartSchema,
  ApplyCouponSchema,
  UpdateCartItemSchema,
} from "../../../lib/medusa/validation";

export async function GET() {
  try {
    const cartId = await getCartId();
    if (!cartId) {
      return NextResponse.json({
        cart: null,
        shippingRules: null,
        freeShippingProgress: null,
      });
    }

    const cart = await getCart(cartId);
    const shippingRules = await getShippingRules();
    const productSubtotal = (cart?.items || [])
      .filter((i) => !i.metadata?.is_cod_fee && i.variant?.sku !== "SERVICE-COD-FEE")
      .reduce((sum, item) => sum + (item.unit_price || 0) * item.quantity, 0);
    const freeShippingProgress = calculateFreeShippingProgress(
      productSubtotal > 0 ? productSubtotal : cart?.item_subtotal || cart?.subtotal || 0,
      shippingRules.threshold,
    );

    return NextResponse.json({
      cart,
      shippingRules,
      freeShippingProgress,
    });
  } catch (err: any) {
    return NextResponse.json({ error: mapMedusaError(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    const cart = await getOrCreateCart();

    if (action === "add") {
      const parsed = AddToCartSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Geçersiz istek" },
          { status: 400 },
        );
      }

      const updated = await addItemToCart(cart.id, parsed.data.variantId, parsed.data.quantity);
      return NextResponse.json({ success: true, cart: updated });
    }

    if (action === "update") {
      const parsed = UpdateCartItemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Geçersiz istek" },
          { status: 400 },
        );
      }

      const updated = await updateCartItem(cart.id, parsed.data.lineItemId, parsed.data.quantity);
      return NextResponse.json({ success: true, cart: updated });
    }

    if (action === "remove") {
      const lineItemId = body.lineItemId;
      if (!lineItemId) {
        return NextResponse.json({ error: "lineItemId eksik" }, { status: 400 });
      }

      const updated = await removeCartItem(cart.id, lineItemId);
      return NextResponse.json({ success: true, cart: updated });
    }

    if (action === "apply_coupon") {
      const parsed = ApplyCouponSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Lütfen geçerli bir kupon kodu giriniz." },
          { status: 400 },
        );
      }

      const updated = await applyPromotionCode(cart.id, parsed.data.code);
      return NextResponse.json({ success: true, cart: updated });
    }

    if (action === "remove_coupon") {
      const code = typeof body.code === "string" ? body.code : "";
      if (!code) {
        return NextResponse.json({ error: "Kupon kodu eksik" }, { status: 400 });
      }

      const updated = await removePromotionCode(cart.id, code);
      return NextResponse.json({ success: true, cart: updated });
    }

    return NextResponse.json({ error: "Geçersiz aksiyon" }, { status: 400 });
  } catch (err: any) {
    const status = err.status || 400;
    const message = mapMedusaError(err);
    return NextResponse.json({ error: message, code: err.code || "CART_ERROR" }, { status });
  }
}
