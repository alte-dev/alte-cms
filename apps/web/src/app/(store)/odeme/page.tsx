import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCart, getCartShippingOptions, getPaymentOptions } from "@/lib/medusa/cart";
import { getServerCustomer, getServerCustomerAddresses } from "@/lib/medusa/account";
import { getProducts } from "@/lib/medusa/products";
import { selectCheckoutRecommendations } from "@/lib/medusa/checkout-recommendations";
import type { StoreProduct } from "@/lib/medusa/types";
import { getSiteSettings } from "@/lib/payload/content";
import { getCartId } from "@/lib/medusa/cookies";
import { CheckoutForm } from "@/components/checkout-form";
export const metadata: Metadata = {
  title: "Ödeme ve Teslimat | Mağaza",
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

  const [shippingOptions, paymentOptions, customer, savedAddresses, siteSettings] =
    await Promise.all([
      getCartShippingOptions(cart.id),
      getPaymentOptions(),
      getServerCustomer(),
      getServerCustomerAddresses(),
      getSiteSettings(),
    ]);

  const checkoutSettings = (siteSettings as any)?.checkout;
  let recommendedProducts: StoreProduct[] = [];
  const recommendedTitle =
    typeof checkoutSettings?.recommendedTitle === "string" &&
    checkoutSettings.recommendedTitle.trim()
      ? checkoutSettings.recommendedTitle.trim()
      : "Bunları da ekleyebilirsiniz";

  if (checkoutSettings?.showRecommendedProducts) {
    const productRes = await getProducts({ limit: 12 }).catch(() => ({ products: [] }));
    const cartProductIds = new Set(
      cart.items.map((item) => item.product_id).filter((id): id is string => Boolean(id)),
    );
    recommendedProducts = selectCheckoutRecommendations({
      products: productRes.products || [],
      cartProductIds,
      source: checkoutSettings.recommendedSource === "manual" ? "manual" : "bestsellers",
      manualHandles: checkoutSettings.recommendedHandles || "",
      limit: Number(checkoutSettings.recommendedLimit || 3),
    });
  }

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
        initialCustomer={customer}
        savedAddresses={savedAddresses}
        recommendedProducts={recommendedProducts}
        recommendedTitle={recommendedTitle}
      />
    </div>
  );
}
