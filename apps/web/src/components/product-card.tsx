import React from "react";
import Link from "next/link";
import { formatTRY } from "../lib/medusa/format";
import { StoreProduct } from "../lib/medusa/types";
import { PlaceholderImage } from "./placeholder-image";

interface ProductCardProps {
  product: StoreProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryVariant = product.variants?.[0];
  const calculatedPrice = primaryVariant?.calculated_price;

  const currentPrice =
    calculatedPrice?.calculated_amount ?? primaryVariant?.prices?.[0]?.amount ?? 0;
  const originalPrice = calculatedPrice?.original_amount ?? currentPrice;
  const isDiscounted = originalPrice > currentPrice;

  return (
    <article className="group relative flex flex-col bg-white border border-stone-200 rounded-lg overflow-hidden hover:shadow-md transition">
      {/* Thumbnail Area */}
      <div className="aspect-square bg-stone-100 relative overflow-hidden">
        <Link href={`/urun/${product.handle}`} className="block w-full h-full">
          <PlaceholderImage
            title={product.title}
            className="w-full h-full group-hover:scale-105 transition duration-300"
          />
        </Link>

        {isDiscounted && (
          <span className="absolute top-3 right-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
            İndirim
          </span>
        )}
      </div>

      {/* Content Area */}
      <div className="p-4 flex flex-col flex-1">
        {product.categories?.[0] && (
          <span className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
            {product.categories[0].name}
          </span>
        )}

        <h3 className="font-semibold text-stone-900 group-hover:text-stone-700 text-sm line-clamp-2 mb-2">
          <Link href={`/urun/${product.handle}`}>{product.title}</Link>
        </h3>

        {/* Pricing */}
        <div className="mt-auto pt-2 flex items-baseline justify-between border-t border-stone-100">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-stone-900">{formatTRY(currentPrice)}</span>
              {isDiscounted && (
                <span className="text-xs text-stone-400 line-through">
                  {formatTRY(originalPrice)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-stone-500">KDV dahil</span>
          </div>

          <Link
            href={`/urun/${product.handle}`}
            className="text-xs font-medium text-stone-700 hover:text-stone-900 underline underline-offset-4"
          >
            İncele
          </Link>
        </div>
      </div>
    </article>
  );
}
