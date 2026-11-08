"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, ShoppingBag, ArrowRight, Truck, Tag, X } from "lucide-react";
import {
  applyCouponAction,
  removeCartItemAction,
  removeCouponAction,
  updateCartItemAction,
} from "../app/(store)/actions";
import { formatTRY, FreeShippingProgress } from "../lib/medusa/format";
import { StoreCart } from "../lib/medusa/types";
import { PlaceholderImage } from "./placeholder-image";

interface CartViewProps {
  initialCart: StoreCart | null;
  shippingProgress: FreeShippingProgress;
}

export function CartView({ initialCart, shippingProgress }: CartViewProps) {
  const [cart, setCart] = useState<StoreCart | null>(initialCart);
  const [couponCode, setCouponCode] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const items = cart?.items || [];
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const handleUpdateQuantity = (lineItemId: string, newQty: number) => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await updateCartItemAction({
        lineItemId,
        quantity: newQty,
      });
      if (result.success && result.data) {
        setCart(result.data);
      } else if (result.error) {
        setErrorMsg(result.error);
      }
    });
  };

  const handleRemoveItem = (lineItemId: string) => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await removeCartItemAction(lineItemId);
      if (result.success && result.data) {
        setCart(result.data);
      } else if (result.error) {
        setErrorMsg(result.error);
      }
    });
  };

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError(null);
    startTransition(async () => {
      const result = await applyCouponAction(couponCode.trim());
      if (result.success && result.data) {
        setCart(result.data);
        setCouponCode("");
      } else if (result.error) {
        setCouponError(result.error);
      }
    });
  };

  const handleRemoveCoupon = (code: string) => {
    setCouponError(null);
    startTransition(async () => {
      const result = await removeCouponAction(code);
      if (result.success && result.data) {
        setCart(result.data);
      } else if (result.error) {
        setCouponError(result.error);
      }
    });
  };

  if (!cart || items.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-stone-100 text-stone-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-stone-900 mb-2">Sepetiniz Boş</h2>
        <p className="text-sm text-stone-500 mb-6">
          Sepetinizde henüz ürün bulunmuyor. Alışverişe başlamak için ürünlerimize göz atın.
        </p>
        <Link
          href="/urunler"
          className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white font-medium rounded-md hover:bg-stone-800 transition"
        >
          Alışverişe Başla →
        </Link>
      </div>
    );
  }

  // Calculate dynamic free shipping progress using current cart subtotal
  const subtotal = cart.item_subtotal ?? cart.subtotal ?? 0;
  const taxTotal = cart.tax_total ?? 0;
  const shippingTotal = cart.shipping_total ?? 0;
  const discountTotal = cart.discount_total ?? 0;
  const total = cart.total ?? subtotal;
  const promotions = cart.promotions || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Items List (Col 8) */}
      <div className="lg:col-span-8 space-y-4">
        {/* Dynamic Free Shipping Bar */}
        {shippingProgress.hasThreshold && (
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-stone-700" />
                <span className="font-semibold text-stone-900">{shippingProgress.message}</span>
              </div>
              <span className="text-xs font-bold text-stone-600">%{shippingProgress.percent}</span>
            </div>
            <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  shippingProgress.isEligible ? "bg-emerald-600" : "bg-stone-900"
                }`}
                style={{ width: `${shippingProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Items Container */}
        <div className="bg-white border border-stone-200 rounded-lg divide-y divide-stone-100 overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="p-4 sm:p-6 flex gap-4 items-center">
              {/* Product Thumbnail */}
              <div className="w-20 h-20 bg-stone-100 rounded-md overflow-hidden flex-shrink-0">
                <PlaceholderImage title={item.title} className="w-full h-full text-[10px]" />
              </div>

              {/* Title & Variant Details */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-stone-900 truncate">{item.title}</h4>
                {item.variant_title && item.variant_title !== "Default Variant" && (
                  <p className="text-xs text-stone-500 mt-0.5">Seçenek: {item.variant_title}</p>
                )}
                <div className="text-sm font-semibold text-stone-900 mt-2">
                  {formatTRY(item.unit_price)}
                  <span className="text-[11px] font-normal text-stone-500 ml-1">KDV dahil</span>
                </div>
              </div>

              {/* Quantity Controls */}
              {item.metadata?.is_cod_fee || item.variant?.sku === "SERVICE-COD-FEE" ? (
                <div className="px-2.5 py-1 text-xs font-medium text-stone-500 bg-stone-100 rounded">
                  1 Adet
                </div>
              ) : (
                <div className="flex items-center border border-stone-300 rounded-md bg-white">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                    className="px-2.5 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition"
                    aria-label="Adet Azalt"
                  >
                    -
                  </button>
                  <span className="px-3 py-1 text-xs font-semibold text-stone-900 select-none min-w-[2rem] text-center">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    disabled={isPending || item.quantity >= 99}
                    onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                    className="px-2.5 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition"
                    aria-label="Adet Artır"
                  >
                    +
                  </button>
                </div>
              )}

              {/* Line Total */}
              <div className="text-right min-w-[5rem]">
                <span className="text-sm font-bold text-stone-900">
                  {formatTRY(item.subtotal || item.total)}
                </span>
              </div>

              {/* Delete Button */}
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleRemoveItem(item.id)}
                className="p-2 text-stone-400 hover:text-red-600 transition"
                aria-label="Ürünü Sil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Sidebar (Col 4) */}
      <div className="lg:col-span-4 bg-white border border-stone-200 rounded-lg p-6 space-y-5 sticky top-24">
        <h3 className="text-base font-bold text-stone-900 pb-3 border-b border-stone-100">
          Sipariş Özeti ({itemCount} Ürün)
        </h3>

        {/* Coupon Input Form */}
        <div className="space-y-2">
          <form onSubmit={handleApplyCoupon} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="İndirim Kodu"
                disabled={isPending}
                className="w-full px-3 py-2 text-sm uppercase font-mono tracking-wider border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-900"
              />
            </div>
            <button
              type="submit"
              disabled={isPending || !couponCode.trim()}
              className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-md hover:bg-stone-800 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Uygula</span>
            </button>
          </form>

          {couponError && <p className="text-xs text-red-600 mt-1">{couponError}</p>}

          {/* Active Promotions Badge */}
          {promotions.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-2">
              {promotions.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-full border border-emerald-200"
                >
                  <Tag className="w-3 h-3" />
                  <span>{p.code}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCoupon(p.code)}
                    disabled={isPending}
                    className="ml-1 text-emerald-600 hover:text-emerald-900"
                    title="Kuponu Kaldır"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2.5 text-sm pt-2 border-t border-stone-100">
          {/* Subtotal */}
          <div className="flex justify-between text-stone-600">
            <span>Ara Toplam (KDV Hariç)</span>
            <span className="font-medium text-stone-900">
              {formatTRY(Math.max(0, subtotal - taxTotal))}
            </span>
          </div>

          {/* Tax Line */}
          <div className="flex justify-between text-stone-600">
            <span>Hesaplanan KDV (%20 Dahil)</span>
            <span className="font-medium text-stone-900">{formatTRY(taxTotal)}</span>
          </div>

          {/* Discount */}
          {discountTotal > 0 && (
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>İndirim Tutarı</span>
              <span>-{formatTRY(discountTotal)}</span>
            </div>
          )}

          {/* Shipping */}
          <div className="flex justify-between text-stone-600">
            <span>Kargo Tutarı</span>
            <span className="font-medium text-stone-900">
              {shippingTotal > 0 ? formatTRY(shippingTotal) : "Hesaplanacak (Ödeme Adımında)"}
            </span>
          </div>

          {/* Total */}
          <div className="pt-3 border-t border-stone-200 flex justify-between items-baseline">
            <div className="flex flex-col">
              <span className="text-base font-bold text-stone-900">Toplam Tutar</span>
              <span className="text-[11px] text-stone-500">Tüm yasal vergiler dahildir</span>
            </div>
            <span className="text-xl font-extrabold text-stone-900">{formatTRY(total)}</span>
          </div>
        </div>

        {/* Checkout Link */}
        <Link
          href="/odeme"
          className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3.5 bg-stone-900 text-white font-medium rounded-md hover:bg-stone-800 transition"
        >
          <span>Ödemeye Geç</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
