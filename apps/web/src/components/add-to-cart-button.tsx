"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ShoppingBag, AlertCircle } from "lucide-react";
import { addToCartAction } from "../app/(store)/actions";
import { formatTRY } from "../lib/medusa/format";
import { StoreProduct, StoreProductVariant } from "../lib/medusa/types";

interface AddToCartButtonProps {
  product: StoreProduct;
}

export function AddToCartForm({ product }: AddToCartButtonProps) {
  const variants = product.variants || [];
  const options = product.options || [];

  // Default option values from first variant
  const initialOptions: Record<string, string> = {};
  if (variants[0]?.options) {
    for (const opt of variants[0].options) {
      initialOptions[opt.option_id] = opt.value;
    }
  }

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(initialOptions);
  const [quantity, setQuantity] = useState<number>(1);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);

  // Find variant matching selected options
  const selectedVariant: StoreProductVariant | undefined =
    variants.find((variant) => {
      if (!variant.options || variant.options.length === 0) return true;
      return variant.options.every((opt) => selectedOptions[opt.option_id] === opt.value);
    }) || variants[0];

  // Stock availability check
  const isOutOfStock =
    selectedVariant?.manage_inventory &&
    !selectedVariant?.allow_backorder &&
    selectedVariant?.inventory_quantity !== undefined &&
    selectedVariant.inventory_quantity <= 0;

  const currentPrice =
    selectedVariant?.calculated_price?.calculated_amount ??
    selectedVariant?.prices?.[0]?.amount ??
    0;
  const originalPrice = selectedVariant?.calculated_price?.original_amount ?? currentPrice;
  const isDiscounted = originalPrice > currentPrice;

  const handleOptionChange = (optionId: string, value: string) => {
    setSelectedOptions((prev) => ({ ...prev, [optionId]: value }));
    setErrorMsg(null);
    setAddedSuccess(false);
  };

  const handleAddToCart = () => {
    if (!selectedVariant) {
      setErrorMsg("Lütfen geçerli bir varyant seçin.");
      return;
    }

    if (isOutOfStock) {
      setErrorMsg("Bu varyantın stoğu tükenmiştir.");
      return;
    }

    setErrorMsg(null);
    setAddedSuccess(false);

    startTransition(async () => {
      const result = await addToCartAction({
        variantId: selectedVariant.id,
        quantity,
      });

      if (!result.success) {
        setErrorMsg(result.error || "Sepete eklenirken bir hata oluştu.");
      } else {
        setAddedSuccess(true);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Price Display */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-stone-900">{formatTRY(currentPrice)}</span>
          {isDiscounted && (
            <span className="text-lg text-stone-400 line-through">{formatTRY(originalPrice)}</span>
          )}
        </div>
        <p className="text-xs text-stone-500 mt-1">Fiyatlarımıza KDV dahildir.</p>
      </div>

      {/* Stock Status Badge */}
      <div>
        {isOutOfStock ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            Tükendi (Stokta Yok)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            Stokta Var
          </span>
        )}
      </div>

      {/* Option Selectors (Size, Color, etc.) */}
      {options.map((option) => (
        <div key={option.id} className="space-y-2">
          <label className="block text-sm font-medium text-stone-700">
            {option.title}:{" "}
            <span className="font-semibold text-stone-900">
              {selectedOptions[option.id] || "Seçiniz"}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {option.values.map((val) => {
              const isSelected = selectedOptions[option.id] === val.value;
              return (
                <button
                  key={val.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleOptionChange(option.id, val.value)}
                  className={`px-4 py-2 text-sm font-medium rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                    isSelected
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-white text-stone-700 hover:border-stone-400"
                  }`}
                >
                  {val.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Quantity & Add Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
        <div className="flex items-center border border-stone-300 rounded-md bg-white">
          <button
            type="button"
            disabled={quantity <= 1 || isPending}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-3 py-2 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition"
            aria-label="Adeti Azalt"
          >
            -
          </button>
          <span className="px-4 py-2 text-sm font-semibold text-stone-900 select-none min-w-[2.5rem] text-center">
            {quantity}
          </span>
          <button
            type="button"
            disabled={quantity >= 99 || isPending || isOutOfStock}
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            className="px-3 py-2 text-stone-600 hover:bg-stone-100 disabled:opacity-50 transition"
            aria-label="Adeti Artır"
          >
            +
          </button>
        </div>

        <button
          type="button"
          disabled={isPending || isOutOfStock}
          onClick={handleAddToCart}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-stone-900 text-white font-medium rounded-md hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed transition"
        >
          <ShoppingBag className="w-5 h-5" />
          {isPending ? "Ekleniyor..." : isOutOfStock ? "Stokta Yok" : "Sepete Ekle"}
        </button>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800"
        >
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Success Notice */}
      {addedSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-md text-sm text-emerald-800"
        >
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-emerald-600" />
            <span>Ürün sepete başarıyla eklendi!</span>
          </div>
          <Link
            href="/sepet"
            className="font-semibold underline underline-offset-4 hover:text-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded"
          >
            Sepete Git →
          </Link>
        </div>
      )}
    </div>
  );
}
