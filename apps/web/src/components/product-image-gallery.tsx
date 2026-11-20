"use client";

import React, { useState } from "react";
import type { ProductGalleryImage } from "../lib/medusa/product-images";
import { PlaceholderImage } from "./placeholder-image";

export function stepGalleryIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (current + delta + total) % total;
}

interface ProductImageGalleryProps {
  title: string;
  images: ProductGalleryImage[];
}

export function ProductImageGallery({ title, images }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const total = images.length;
  const safeIndex = total > 0 ? Math.min(activeIndex, total - 1) : 0;
  const activeImage = total > 0 ? images[safeIndex] : null;
  const hasMultiple = total > 1;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!hasMultiple) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveIndex((prev) => stepGalleryIndex(prev, 1, total));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveIndex((prev) => stepGalleryIndex(prev, -1, total));
    }
  };

  return (
    <div
      className="space-y-4"
      onKeyDown={handleKeyDown}
      role="region"
      aria-label={`${title} ürün görselleri`}
    >
      {/* Main Image */}
      <div className="aspect-square bg-stone-100 rounded-2xl overflow-hidden border border-stone-200 relative group">
        {activeImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeImage.url}
            alt={hasMultiple ? `${title} - Görsel ${safeIndex + 1}` : title}
            className="w-full h-full object-cover"
          />
        ) : (
          <PlaceholderImage title={title} className="w-full h-full" />
        )}

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={() => setActiveIndex((prev) => stepGalleryIndex(prev, -1, total))}
              aria-label="Önceki görsel"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-stone-900 shadow-sm border border-stone-200 flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setActiveIndex((prev) => stepGalleryIndex(prev, 1, total))}
              aria-label="Sonraki görsel"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-stone-900 shadow-sm border border-stone-200 flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <span
              className="absolute bottom-3 right-3 bg-stone-900/75 text-white text-xs font-medium px-2.5 py-1 rounded-full"
              aria-live="polite"
            >
              {safeIndex + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/* Thumbnail Strip */}
      {hasMultiple && (
        <div className="grid grid-cols-4 gap-3 sm:gap-4">
          {images.map((img, i) => {
            const isActive = i === safeIndex;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`${title} - Görsel ${i + 1}`}
                aria-pressed={isActive}
                className={`aspect-square bg-stone-100 rounded-lg overflow-hidden border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 ${
                  isActive
                    ? "border-stone-900 ring-2 ring-stone-900/20"
                    : "border-stone-200 hover:border-stone-400 opacity-80 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`${title} - Küçük görsel ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
