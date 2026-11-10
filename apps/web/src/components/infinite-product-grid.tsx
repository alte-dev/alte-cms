"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { StoreProduct } from "@/lib/medusa/types";
import { ProductCard } from "@/components/product-card";
import { fetchMoreProductsAction } from "@/app/(store)/actions";
import { Loader2 } from "lucide-react";

interface InfiniteProductGridProps {
  initialProducts: StoreProduct[];
  initialPage: number;
  totalPages: number;
  category?: string;
  sort?: "created_at" | "price_asc" | "price_desc";
  limit?: number;
}

export function InfiniteProductGrid({
  initialProducts,
  initialPage,
  totalPages,
  category,
  sort,
  limit = 12,
}: InfiniteProductGridProps) {
  const [products, setProducts] = useState<StoreProduct[]>(initialProducts);
  const [page, setPage] = useState<number>(initialPage);
  const [hasMore, setHasMore] = useState<boolean>(initialPage < totalPages);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // If initialProducts or category/sort change from props, reset local state
  useEffect(() => {
    setProducts(initialProducts);
    setPage(initialPage);
    setHasMore(initialPage < totalPages);
    setErrorMsg(null);
  }, [initialProducts, initialPage, totalPages, category, sort]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setErrorMsg(null);

    const nextPage = page + 1;
    const res = await fetchMoreProductsAction({
      page: nextPage,
      limit,
      category,
      sort,
    });

    if (res.success && res.products.length > 0) {
      setProducts((prev) => {
        // Prevent duplicate products by ID
        const existingIds = new Set(prev.map((p) => p.id));
        const newUnique = res.products.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newUnique];
      });
      setPage(res.currentPage);
      setHasMore(res.hasMore);
    } else {
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setHasMore(false);
      }
    }

    setIsLoading(false);
  }, [isLoading, hasMore, page, limit, category, sort]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !isLoading && hasMore) {
          loadMore();
        }
      },
      {
        rootMargin: "300px", // Trigger before user reaches the very bottom
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoading]);

  return (
    <div className="w-full">
      {/* Product Grid */}
      <div
        role="feed"
        aria-busy={isLoading}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {/* Screen reader live updates */}
      <div className="sr-only" aria-live="polite">
        {isLoading ? "Yeni ürünler yükleniyor..." : `${products.length} ürün listelendi.`}
      </div>

      {/* Loading Skeleton / Spinner */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-6 h-6 text-stone-900 animate-spin" aria-hidden="true" />
          <span className="text-xs font-medium text-stone-600">Daha fazla ürün yükleniyor...</span>
        </div>
      )}

      {/* Error state with retry button */}
      {errorMsg && (
        <div className="text-center py-8">
          <p className="text-xs text-red-600 mb-3">{errorMsg}</p>
          <button
            type="button"
            onClick={loadMore}
            className="px-4 py-2 text-xs font-semibold bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition"
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {/* End of catalog indicator */}
      {!hasMore && products.length > 0 && (
        <div className="text-center py-12 border-t border-stone-200 mt-12">
          <p className="text-xs font-medium text-stone-500">
            Tüm ürünleri görüntülediniz ({products.length} ürün)
          </p>
        </div>
      )}

      {/* Observer target sentinel */}
      <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
    </div>
  );
}
