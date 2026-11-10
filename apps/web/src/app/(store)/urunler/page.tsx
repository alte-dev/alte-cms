import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getProducts, getCategories } from "@/lib/medusa/products";
import { ProductQuerySchema } from "@/lib/medusa/validation";
import { ProductCard } from "@/components/product-card";
import { Pagination } from "@/components/pagination";
import { InfiniteProductGrid } from "@/components/infinite-product-grid";
import { getSiteSettings } from "@/lib/payload/content";

export const metadata: Metadata = {
  title: "Tüm Ürünler",
  description: "Özenle tasarlanmış tüm giyim ve yaşam ürünleri. Fiyatlarımıza KDV dahildir.",
};

export const dynamic = "force-dynamic";

interface UrunlerPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function UrunlerPage({ searchParams }: UrunlerPageProps) {
  const rawParams = await searchParams;
  const parsed = ProductQuerySchema.safeParse(rawParams);

  const query = parsed.success ? parsed.data : { page: 1, limit: 12, sort: "created_at" as const };

  const [categories, settings] = await Promise.all([getCategories(), getSiteSettings()]);
  const isInfinite = settings?.catalogListingMode === "infinite";

  // If category handle or id was passed
  let categoryId: string | undefined = undefined;
  if (query.category) {
    const matched = categories.find((c) => c.handle === query.category || c.id === query.category);
    if (matched) {
      categoryId = matched.id;
    }
  }

  const { products, count, totalPages, currentPage } = await getProducts({
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    category_id: categoryId,
    q: query.q,
  });

  const buildUrl = (newParams: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    if (query.category) params.set("category", query.category);
    if (query.sort && query.sort !== "created_at") params.set("sort", query.sort);
    if (query.page && query.page > 1) params.set("page", String(query.page));

    for (const [key, value] of Object.entries(newParams)) {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }

    const qs = params.toString();
    return qs ? `/urunler?${qs}` : "/urunler";
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 overflow-x-hidden">
      {/* Page Header */}
      <div className="border-b border-stone-200 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">Tüm Ürünler</h1>
        <p className="text-sm text-stone-500 mt-1">
          Toplam {count} ürün listeleniyor • Fiyatlarımıza KDV dahildir.
        </p>
      </div>

      {/* Filters & Sorting Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <Link
            href={buildUrl({ category: undefined, page: 1 })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              !query.category
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            Tümü
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={buildUrl({ category: cat.handle, page: 1 })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                query.category === cat.handle
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Sorting Dropdown (Link based) */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-stone-500 font-medium">Sırala:</span>
          <div className="flex items-center gap-1">
            <Link
              href={buildUrl({ sort: "created_at", page: 1 })}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                query.sort === "created_at"
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              En Yeni
            </Link>
            <Link
              href={buildUrl({ sort: "price_asc", page: 1 })}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                query.sort === "price_asc"
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              Fiyat: Artan
            </Link>
            <Link
              href={buildUrl({ sort: "price_desc", page: 1 })}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                query.sort === "price_desc"
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              Fiyat: Azalan
            </Link>
          </div>
        </div>
      </div>

      {/* Product Grid or Infinite Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200 p-8">
          <h3 className="text-lg font-bold text-stone-800 mb-2">Ürün Bulunamadı</h3>
          <p className="text-sm text-stone-500 mb-6">
            Seçtiğiniz filtrelere uygun ürün bulunmamaktadır.
          </p>
          <Link
            href="/urunler"
            className="inline-flex items-center px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition"
          >
            Filtreleri Temizle
          </Link>
        </div>
      ) : isInfinite ? (
        <InfiniteProductGrid
          initialProducts={products}
          initialPage={currentPage}
          totalPages={totalPages}
          category={query.category}
          sort={query.sort}
          limit={query.limit}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            buildUrl={(p) => buildUrl({ page: p })}
          />
        </>
      )}
    </div>
  );
}
