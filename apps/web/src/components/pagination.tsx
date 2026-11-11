import React from "react";
import Link from "next/link";
import { getPaginationRange, type PaginationItem } from "@/lib/pagination";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  buildUrl: (page: number) => string;
  className?: string;
}

export function Pagination({ currentPage, totalPages, buildUrl, className = "" }: PaginationProps) {
  if (totalPages <= 1) return null;

  const range: PaginationItem[] = getPaginationRange(currentPage, totalPages);

  return (
    <nav
      aria-label="Sayfalama"
      className={`flex items-center justify-center gap-2 pt-8 w-full max-w-full overflow-hidden ${className}`}
    >
      {/* Önceki Butonu */}
      {currentPage > 1 ? (
        <Link
          href={buildUrl(currentPage - 1)}
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-medium bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 transition shrink-0"
          aria-label="Önceki sayfaya git"
        >
          &larr; <span className="hidden sm:inline ml-1">Önceki</span>
        </Link>
      ) : (
        <span
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-medium bg-stone-100 border border-stone-200 rounded-lg text-stone-400 cursor-not-allowed shrink-0"
          aria-disabled="true"
        >
          &larr; <span className="hidden sm:inline ml-1">Önceki</span>
        </span>
      )}

      {/* Mobil Kompakt Sayfa Göstergesi (sm:hidden) */}
      <span className="sm:hidden text-xs font-semibold text-stone-700 px-2 py-1 bg-stone-100 rounded-md">
        Sayfa {currentPage} / {totalPages}
      </span>

      {/* Masaüstü Sliding Window Numaraları (hidden sm:flex) */}
      <div className="hidden sm:flex items-center gap-1">
        {range.map((item, idx) => {
          if (item === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="w-9 h-9 flex items-center justify-center text-xs font-bold text-stone-400 select-none"
                aria-hidden="true"
              >
                ...
              </span>
            );
          }

          const isCurrent = item === currentPage;
          return (
            <Link
              key={item}
              href={buildUrl(item)}
              aria-current={isCurrent ? "page" : undefined}
              aria-label={`Sayfa ${item}`}
              className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-semibold transition shrink-0 ${
                isCurrent
                  ? "bg-stone-900 text-white shadow-sm"
                  : "bg-white border border-stone-300 text-stone-700 hover:bg-stone-50"
              }`}
            >
              {item}
            </Link>
          );
        })}
      </div>

      {/* Sonraki Butonu */}
      {currentPage < totalPages ? (
        <Link
          href={buildUrl(currentPage + 1)}
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-medium bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 transition shrink-0"
          aria-label="Sonraki sayfaya git"
        >
          <span className="hidden sm:inline mr-1">Sonraki</span> &rarr;
        </Link>
      ) : (
        <span
          className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-medium bg-stone-100 border border-stone-200 rounded-lg text-stone-400 cursor-not-allowed shrink-0"
          aria-disabled="true"
        >
          <span className="hidden sm:inline mr-1">Sonraki</span> &rarr;
        </span>
      )}
    </nav>
  );
}
