"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { StoreProduct } from "../lib/medusa/types";
import { ProductCard } from "./product-card";
import { fetchMoreProductsAction } from "../app/(store)/actions";
import { Loader2 } from "lucide-react";
import {
  buildInfiniteGridStorageKey,
  clearInfiniteGridSnapshot,
  consumeBackNavigation,
  getBrowserSessionStorage,
  loadInfiniteGridSnapshot,
  saveInfiniteGridSnapshot,
} from "../lib/infinite-scroll-state";

export const MIN_INFINITE_SCROLL_DELAY_MS = 500;

export function waitMinDelay(ms: number = MIN_INFINITE_SCROLL_DELAY_MS): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col bg-white border border-stone-200 rounded-lg overflow-hidden animate-pulse"
    >
      <div className="aspect-square bg-stone-200" />
      <div className="p-4 flex flex-col gap-2.5">
        <div className="h-3 w-1/3 bg-stone-200 rounded" />
        <div className="h-4 w-4/5 bg-stone-200 rounded" />
        <div className="pt-2 mt-1 border-t border-stone-100 flex items-center justify-between">
          <div className="h-5 w-1/3 bg-stone-200 rounded" />
          <div className="h-3 w-12 bg-stone-200 rounded" />
        </div>
      </div>
    </div>
  );
}

interface InfiniteProductGridProps {
  initialProducts: StoreProduct[];
  initialPage: number;
  totalPages: number;
  category?: string;
  sort?: "created_at" | "price_asc" | "price_desc";
  limit?: number;
  autoLoadPages?: number;
}

export function InfiniteProductGrid({
  initialProducts,
  initialPage,
  totalPages,
  category,
  sort,
  limit = 12,
  autoLoadPages = 3,
}: InfiniteProductGridProps) {
  const [products, setProducts] = useState<StoreProduct[]>(initialProducts);
  const [newlyLoadedIds, setNewlyLoadedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState<number>(initialPage);
  const [hasMore, setHasMore] = useState<boolean>(initialPage < totalPages);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoLoadLimit, setAutoLoadLimit] = useState<number>(autoLoadPages);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const activeStorageKeyRef = useRef<string | null>(null);
  const hasHydratedStateRef = useRef<boolean>(false);
  const scrollYRef = useRef<number>(0);
  const [pendingScroll, setPendingScroll] = useState<{ y: number; expectedCount: number } | null>(
    null,
  );
  const isRestoringScrollRef = useRef<boolean>(false);
  const latestStateRef = useRef({
    products,
    page,
    hasMore,
    autoLoadLimit,
    category,
    sort,
    limit,
  });
  latestStateRef.current = {
    products,
    page,
    hasMore,
    autoLoadLimit,
    category,
    sort,
    limit,
  };

  // Restore saved infinite-scroll state on browser Back/Forward, or reset on fresh navigation
  useEffect(() => {
    const key = buildInfiniteGridStorageKey(window.location.pathname, window.location.search);
    activeStorageKeyRef.current = key;
    const storage = getBrowserSessionStorage();

    if (consumeBackNavigation()) {
      const snapshot = loadInfiniteGridSnapshot(storage, key, {
        category,
        sort,
        limit,
        initialFirstId: initialProducts[0]?.id,
      });

      if (snapshot) {
        isRestoringScrollRef.current = true;
        setProducts(snapshot.products);
        setNewlyLoadedIds(new Set());
        setPage(snapshot.page);
        setHasMore(snapshot.hasMore && snapshot.page < totalPages);
        setErrorMsg(null);
        setAutoLoadLimit(Math.max(snapshot.autoLoadLimit, autoLoadPages));
        setPendingScroll({ y: snapshot.scrollY, expectedCount: snapshot.products.length });
        scrollYRef.current = snapshot.scrollY;
        hasHydratedStateRef.current = true;
        return;
      }
    }

    clearInfiniteGridSnapshot(storage, key);
    isRestoringScrollRef.current = false;
    setProducts(initialProducts);
    setNewlyLoadedIds(new Set());
    setPage(initialPage);
    setHasMore(initialPage < totalPages);
    setErrorMsg(null);
    setAutoLoadLimit(autoLoadPages);
    setPendingScroll(null);
    scrollYRef.current = 0;
    hasHydratedStateRef.current = true;
  }, [initialProducts, initialPage, totalPages, category, sort, limit, autoLoadPages]);

  // Apply restored scroll position after restored products have rendered into the DOM
  useEffect(() => {
    if (!pendingScroll || products.length < pendingScroll.expectedCount) return;
    const targetY = pendingScroll.y;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        scrollYRef.current = targetY;
        window.scrollTo({ top: targetY, behavior: "instant" as ScrollBehavior });
        isRestoringScrollRef.current = false;
        setPendingScroll(null);
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [products, pendingScroll]);

  // Persist pagination state whenever loaded products or page state changes
  useEffect(() => {
    if (
      !hasHydratedStateRef.current ||
      !activeStorageKeyRef.current ||
      isRestoringScrollRef.current
    ) {
      return;
    }
    saveInfiniteGridSnapshot(getBrowserSessionStorage(), activeStorageKeyRef.current, {
      products,
      page,
      hasMore,
      autoLoadLimit,
      scrollY: scrollYRef.current,
      category,
      sort,
      limit,
    });
  }, [products, page, hasMore, autoLoadLimit, category, sort, limit]);

  // Track scroll position and flush snapshot on pagehide/unmount
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const persistCurrent = () => {
      if (
        !hasHydratedStateRef.current ||
        !activeStorageKeyRef.current ||
        isRestoringScrollRef.current
      ) {
        return;
      }
      saveInfiniteGridSnapshot(getBrowserSessionStorage(), activeStorageKeyRef.current, {
        ...latestStateRef.current,
        scrollY: scrollYRef.current,
      });
    };

    const handleScroll = () => {
      if (isRestoringScrollRef.current) return;
      scrollYRef.current = window.scrollY;
      if (timer) clearTimeout(timer);
      timer = setTimeout(persistCurrent, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", persistCurrent);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", persistCurrent);
      persistCurrent();
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setErrorMsg(null);

    const nextPage = page + 1;
    const [res] = await Promise.all([
      fetchMoreProductsAction({
        page: nextPage,
        limit,
        category,
        sort,
      }),
      waitMinDelay(MIN_INFINITE_SCROLL_DELAY_MS),
    ]);

    if (res.success && res.products.length > 0) {
      const existingIds = new Set(products.map((p) => p.id));
      const newUnique = res.products.filter((p) => !existingIds.has(p.id));
      if (newUnique.length > 0) {
        setProducts((prev) => {
          const prevIds = new Set(prev.map((p) => p.id));
          const deduped = newUnique.filter((p) => !prevIds.has(p.id));
          return deduped.length > 0 ? [...prev, ...deduped] : prev;
        });
        setNewlyLoadedIds((prevIds) => {
          const updated = new Set(prevIds);
          for (const item of newUnique) updated.add(item.id);
          return updated;
        });
      }
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
  }, [isLoading, hasMore, page, limit, category, sort, products]);

  // Anti-exhaustion guard: pause auto-scroll once page reaches the threshold
  const isPausedForManual = hasMore && page >= autoLoadLimit;

  const handleManualLoadMore = useCallback(() => {
    setAutoLoadLimit((prev) => prev + autoLoadPages);
    loadMore();
  }, [autoLoadPages, loadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isPausedForManual) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !isLoading && hasMore && !isPausedForManual) {
          loadMore();
        }
      },
      {
        rootMargin: "100px", // Trigger near bottom so skeleton animation is visible
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoading, isPausedForManual]);

  return (
    <div className="w-full">
      {/* Product Grid */}
      <div
        role="feed"
        aria-busy={isLoading}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
      >
        {products.map((product) => (
          <div
            key={product.id}
            className={newlyLoadedIds.has(product.id) ? "animate-fade-in-up" : undefined}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {/* Screen reader live updates */}
      <div className="sr-only" aria-live="polite">
        {isLoading ? "Yeni ürünler yükleniyor..." : `${products.length} ürün listelendi.`}
      </div>

      {/* Loading Skeleton Grid + Spinner */}
      {isLoading && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <ProductCardSkeleton key={idx} />
            ))}
          </div>
          <div className="flex items-center justify-center py-4 gap-2.5">
            <Loader2 className="w-5 h-5 text-stone-900 animate-spin" aria-hidden="true" />
            <span className="text-xs font-medium text-stone-600">
              Daha fazla ürün yükleniyor...
            </span>
          </div>
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

      {/* Anti-Exhaustion Guard & Manual Load More Button */}
      {hasMore && !isLoading && isPausedForManual && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 border-t border-stone-200 mt-10">
          <p className="text-xs text-stone-600 font-medium">
            {products.length} ürün listelendi. Daha fazla ürün keşfetmek için:
          </p>
          <button
            type="button"
            onClick={handleManualLoadMore}
            className="px-6 py-2.5 text-xs font-semibold bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:ring-offset-2"
          >
            Daha Fazla Ürün Göster
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

      {/* Observer target sentinel (only active when not paused) */}
      {hasMore && !isPausedForManual && (
        <div ref={sentinelRef} className="h-4 w-full" aria-hidden="true" />
      )}
    </div>
  );
}
