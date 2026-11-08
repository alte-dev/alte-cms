import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCart, getCartShippingOptions, getPaymentOptions } from "@/lib/medusa/cart";
import { getCartId } from "@/lib/medusa/cookies";
import { CheckoutForm } from "@/components/checkout-form";
import { STORE_NAME } from "@/lib/constants/store-config";

export const metadata: Metadata = {
  title: `Ödeme ve Teslimat | ${STORE_NAME}`,
  description: "Güvenli misafir ödeme ve sipariş tamamlama sayfası",
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cartId = await getCartId();
  if (!cartId) {
    redirect("/sepet");
  }

  const cart = await getCart(cartId);
  if (!cart || !cart.items || cart.items.length === 0) {
    redirect("/sepet");
  }

  const shippingOptions = await getCartShippingOptions(cart.id);
  const paymentOptions = await getPaymentOptions();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="border-b border-stone-200 pb-4 mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">Ödeme ve Teslimat</h1>
        <p className="text-sm text-stone-500 mt-1">
          Lütfen teslimat ve fatura bilgilerinizi eksiksiz doldurunuz.
        </p>
      </div>

      <CheckoutForm
        initialCart={cart}
        shippingOptions={shippingOptions}
        paymentOptions={paymentOptions}
      />
    </div>
  );
}
