"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StoreProduct } from "../lib/medusa/types";
import { ProductCard } from "./product-card";
import { fetchMoreProductsAction } from "../app/(store)/actions";
import { Loader2 } from "lucide-react";
import {
  buildInfinitePagesUrl,
  buildInfiniteScrollKey,
  clearInfiniteScrollY,
  consumeBackNavigation,
  getBrowserSessionStorage,
  loadInfiniteScrollY,
  saveInfiniteScrollY,
} from "../lib/infinite-scroll-url";

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
  const router = useRouter();
  const [products, setProducts] = useState<StoreProduct[]>(initialProducts);
  const [newlyLoadedIds, setNewlyLoadedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState<number>(initialPage);
  const [hasMore, setHasMore] = useState<boolean>(initialPage < totalPages);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoLoadLimit, setAutoLoadLimit] = useState<number>(() =>
    Math.max(autoLoadPages, Math.ceil(initialPage / autoLoadPages) * autoLoadPages),
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const activeListingUrlRef = useRef<string | null>(null);
  const activeScrollKeyRef = useRef<string | null>(null);
  const scrollYRef = useRef<number>(0);
  const isRestoringRef = useRef<boolean>(false);
  const navigatingAwayRef = useRef<boolean>(false);

  // Sync props when route/filter changes and restore scroll position on Back/Forward
  useEffect(() => {
    setProducts(initialProducts);
    setNewlyLoadedIds(new Set());
    setPage(initialPage);
    setHasMore(initialPage < totalPages);
    setErrorMsg(null);
    setAutoLoadLimit(
      Math.max(autoLoadPages, Math.ceil(initialPage / autoLoadPages) * autoLoadPages),
    );

    const currentUrl = window.location.pathname + window.location.search;
    const key = buildInfiniteScrollKey(window.location.pathname, window.location.search);
    activeListingUrlRef.current = currentUrl;
    activeScrollKeyRef.current = key;

    const storage = getBrowserSessionStorage();
    let rafId = 0;

    if (consumeBackNavigation()) {
      const savedY = loadInfiniteScrollY(storage, key);
      if (savedY !== null && savedY > 0) {
        isRestoringRef.current = true;
        scrollYRef.current = savedY;
        let attempts = 0;

        const attemptRestore = () => {
          attempts += 1;
          const maxScrollable = document.documentElement.scrollHeight - window.innerHeight;
          if (maxScrollable >= savedY || attempts >= 30) {
            window.scrollTo({ top: savedY, behavior: "instant" as ScrollBehavior });
            scrollYRef.current = savedY;
            isRestoringRef.current = false;
            return;
          }
          rafId = window.requestAnimationFrame(attemptRestore);
        };

        rafId = window.requestAnimationFrame(attemptRestore);
        return () => {
          if (rafId) window.cancelAnimationFrame(rafId);
          isRestoringRef.current = false;
        };
      }
    }

    clearInfiniteScrollY(storage, key);
    scrollYRef.current = 0;
    isRestoringRef.current = false;
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [initialProducts, initialPage, totalPages, category, sort, autoLoadPages]);

  // Manage manual scrollRestoration and persist scrollY before leaving via link click
  useEffect(() => {
    const prevRestoration =
      "scrollRestoration" in window.history ? window.history.scrollRestoration : undefined;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    let navResetTimer: ReturnType<typeof setTimeout> | null = null;

    const persistCurrent = () => {
      if (!activeScrollKeyRef.current || isRestoringRef.current) return;
      if (
        activeListingUrlRef.current !== null &&
        window.location.pathname + window.location.search !== activeListingUrlRef.current
      ) {
        return;
      }
      saveInfiniteScrollY(
        getBrowserSessionStorage(),
        activeScrollKeyRef.current,
        scrollYRef.current,
      );
    };

    const handleScroll = () => {
      if (isRestoringRef.current || navigatingAwayRef.current) return;
      if (
        activeListingUrlRef.current !== null &&
        window.location.pathname + window.location.search !== activeListingUrlRef.current
      ) {
        return;
      }
      scrollYRef.current = window.scrollY;
      if (timer) clearTimeout(timer);
      timer = setTimeout(persistCurrent, 150);
    };

    const handleLinkClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.target === "_blank") return;
      scrollYRef.current = window.scrollY;
      navigatingAwayRef.current = true;
      persistCurrent();
      if (navResetTimer) clearTimeout(navResetTimer);
      navResetTimer = setTimeout(() => {
        navigatingAwayRef.current = false;
      }, 1000);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", persistCurrent);
    document.addEventListener("click", handleLinkClickCapture, true);

    return () => {
      if (timer) clearTimeout(timer);
      if (navResetTimer) clearTimeout(navResetTimer);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", persistCurrent);
      document.removeEventListener("click", handleLinkClickCapture, true);
      persistCurrent();
      navigatingAwayRef.current = false;
      if (prevRestoration && "scrollRestoration" in window.history) {
        window.history.scrollRestoration = prevRestoration;
      }
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
      if (typeof window !== "undefined") {
        const nextUrl = buildInfinitePagesUrl(
          window.location.pathname,
          window.location.search,
          res.currentPage,
        );
        activeListingUrlRef.current = nextUrl;
        activeScrollKeyRef.current = buildInfiniteScrollKey(nextUrl, "");
        router.replace(nextUrl, { scroll: false });
      }
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
