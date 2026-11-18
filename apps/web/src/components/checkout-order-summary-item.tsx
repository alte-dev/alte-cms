import React from "react";
import { formatTRY } from "../lib/medusa/format";
import type { StoreCartLineItem } from "../lib/medusa/types";
import { isSafeHref } from "../lib/safe-href";
import { PlaceholderImage } from "./placeholder-image";

/**
 * Resolves a safe image URL for a cart line item, falling back to its product thumbnail.
 */
export function resolveCartItemThumbnail(item: StoreCartLineItem): string | null {
  const variantProduct = (item.variant as { product?: { thumbnail?: string | null } } | undefined)
    ?.product;
  const raw = item.thumbnail || variantProduct?.thumbnail;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (isSafeHref(trimmed)) return trimmed;
  if (
    process.env.NODE_ENV !== "production" &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(trimmed)
  ) {
    return trimmed;
  }
  return null;
}

/**
 * Resolves a clean variant label for display, hiding Medusa's default placeholder title.
 */
export function resolveCartItemVariantLabel(item: StoreCartLineItem): string | null {
  const raw = item.variant_title || item.variant?.title || item.subtitle;
  if (!raw || raw === "Default Variant") return null;
  return raw;
}

/**
 * Renders a single cart line item in the Shopify/Normod-style checkout order summary:
 * 64x64 bordered white thumbnail box with a top-right circular quantity badge.
 */
export function CheckoutOrderSummaryItem({ item }: { item: StoreCartLineItem }) {
  const thumbnail = resolveCartItemThumbnail(item);
  const variantLabel = resolveCartItemVariantLabel(item);
  const lineTotal =
    (item.unit_price ? item.unit_price * item.quantity : 0) || item.total || item.subtotal;

  return (
    <div className="flex items-center gap-3.5 py-2">
      <div className="relative w-16 h-16 flex-shrink-0">
        <div className="w-16 h-16 rounded-lg border border-[#D6D6D6] bg-white overflow-hidden flex items-center justify-center">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt={item.product_title || item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <PlaceholderImage
              title={item.product_title || item.title}
              className="w-full h-full text-[8px] bg-white"
            />
          )}
        </div>
        <span
          aria-label={`Adet: ${item.quantity}`}
          className="absolute -top-2 -right-2 min-w-[21px] h-[21px] px-1.5 rounded-full bg-[var(--theme-checkout-badge-bg,#666666)] text-white text-[12px] font-semibold flex items-center justify-center leading-none shadow-sm"
        >
          {item.quantity}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-stone-900 leading-snug line-clamp-2">
          {item.product_title || item.title}
        </p>
        {variantLabel && (
          <p className="text-[12px] text-[#666666] mt-0.5 truncate">{variantLabel}</p>
        )}
      </div>

      <span className="text-[14px] font-medium text-stone-900 tabular-nums flex-shrink-0">
        {formatTRY(lineTotal)}
      </span>
    </div>
  );
}
