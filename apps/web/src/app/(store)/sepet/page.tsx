import React from "react";
import type { Metadata } from "next";
import { getCart, getShippingRules } from "@/lib/medusa/cart";
import { getCartId } from "@/lib/medusa/cookies";
import { calculateFreeShippingProgress } from "@/lib/medusa/format";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = {
  title: "Alışveriş Sepetim",
  description: "Sepetinizdeki ürünleri görüntüleyin ve siparişinizi tamamlayın.",
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cartId = await getCartId();
  const [cart, rules] = await Promise.all([
    cartId ? getCart(cartId) : Promise.resolve(null),
    getShippingRules(),
  ]);

  const productSubtotal = (cart?.items || [])
    .filter((i) => !i.metadata?.is_cod_fee && i.variant?.sku !== "SERVICE-COD-FEE")
    .reduce((sum, item) => sum + (item.unit_price || 0) * item.quantity, 0);
  const subtotal =
    productSubtotal > 0 ? productSubtotal : (cart?.item_subtotal ?? cart?.subtotal ?? 0);
  const shippingProgress = calculateFreeShippingProgress(subtotal, rules.threshold);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="border-b border-stone-200 pb-4 mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">Alışveriş Sepeti</h1>
        <p className="text-sm text-stone-500 mt-1">Sepetinizdeki ürünler ve sipariş özeti</p>
      </div>

      <CartView initialCart={cart} shippingProgress={shippingProgress} />
    </div>
  );
}
