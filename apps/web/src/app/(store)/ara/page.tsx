import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { searchProducts, getCategories } from "@/lib/medusa/products";
import { ProductCard } from "@/components/product-card";
import { getSiteSettings } from "@/lib/payload/content";
import { Search, SlidersHorizontal, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

interface Props {
  searchParams: Promise<{
    q?: string;
    category?: string;
    min_price?: string;
    max_price?: string;
    in_stock?: string;
    sort?: string;
    page?: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const settings = await getSiteSettings().catch(() => null);
  const storeName = settings?.storeName || "Mağaza";

  const title = q ? `"${q}" için Arama Sonuçları | ${storeName}` : `Ürün Arama | ${storeName}`;

  return {
    title,
    description: "Geniş ürün koleksiyonumuzda hızlı ve kolay arama yapın.",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function SearchResultsPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawQ = params.q?.trim() || "";
  const categoryHandle = params.category || "";
  const minPrice = params.min_price ? parseFloat(params.min_price) : undefined;
  const maxPrice = params.max_price ? parseFloat(params.max_price) : undefined;
  const inStock = params.in_stock === "true";
  const sort = (params.sort as any) || "relevance";
  const currentPage = Math.max(1, parseInt(params.page || "1", 10));
  const limit = 12;
  const offset = (currentPage - 1) * limit;

  // Retrieve categories for filter sidebar
  const categories = await getCategories().catch(() => []);

  // Validation: Query must be at least 2 characters
  if (rawQ.length < 2) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-stone-100 rounded-full flex items-center justify-center text-stone-500">
            <Search className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Arama Yapın</h1>
          <p className="text-stone-600 mb-8 text-sm">
            Lütfen arama yapmak için en az 2 karakter giriniz.
          </p>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 text-left">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
              Popüler Kategoriler
            </h2>
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 8).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/kategori/${cat.handle}`}
                  className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-stone-200 text-stone-800 rounded-full border border-stone-200 transition"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Execute Search via Medusa v2 Store API
  const searchResult = await searchProducts({
    q: rawQ,
    category: categoryHandle || undefined,
    min_price: minPrice,
    max_price: maxPrice,
    in_stock: inStock || undefined,
    sort,
    limit,
    offset,
  });

  const products = searchResult.products || [];
  const totalCount = searchResult.count || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Helper to generate filter URLs
  const createQueryUrl = (updates: Record<string, string | undefined>) => {
    const current = new URLSearchParams();
    current.set("q", rawQ);
    if (categoryHandle) current.set("category", categoryHandle);
    if (minPrice !== undefined) current.set("min_price", String(minPrice));
    if (maxPrice !== undefined) current.set("max_price", String(maxPrice));
    if (inStock) current.set("in_stock", "true");
    if (sort && sort !== "relevance") current.set("sort", sort);
    if (currentPage > 1) current.set("page", String(currentPage));

    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined || val === "") {
        current.delete(key);
      } else {
        current.set(key, val);
      }
    }
    return `/ara?${current.toString()}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header Info */}
      <div className="border-b border-stone-200 pb-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
              &ldquo;{rawQ}&rdquo; için arama sonuçları
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Toplam <span className="font-semibold text-stone-900">{totalCount}</span> ürün bulundu
            </p>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-medium text-stone-500">Sırala:</span>
            <form method="GET" action="/ara" className="flex items-center gap-1.5">
              <input type="hidden" name="q" value={rawQ} />
              {categoryHandle && <input type="hidden" name="category" value={categoryHandle} />}
              {minPrice !== undefined && <input type="hidden" name="min_price" value={minPrice} />}
              {maxPrice !== undefined && <input type="hidden" name="max_price" value={maxPrice} />}
              {inStock && <input type="hidden" name="in_stock" value="true" />}
              <select
                name="sort"
                defaultValue={sort}
                className="text-xs sm:text-sm bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-stone-800 font-medium focus:outline-none focus:ring-1 focus:ring-stone-900"
              >
                <option value="relevance">En Alakalı</option>
                <option value="price_asc">Fiyat: Düşükten Yükseğe</option>
                <option value="price_desc">Fiyat: Yüksekten Düşüğe</option>
                <option value="newest">En Yeniler</option>
              </select>
              <button
                type="submit"
                className="text-xs bg-stone-900 text-white font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-800 transition"
              >
                Sırala
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-6">
            <div className="flex items-center gap-2 font-semibold text-stone-900 text-sm border-b border-stone-100 pb-3">
              <SlidersHorizontal className="w-4 h-4 text-stone-600" />
              <span>Filtreler</span>
            </div>

            {/* Category Filter */}
            <div>
              <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">
                Kategoriler
              </h3>
              <div className="space-y-1">
                <Link
                  href={createQueryUrl({ category: undefined, page: "1" })}
                  className={`block px-2.5 py-1.5 text-xs rounded-md transition ${
                    !categoryHandle
                      ? "bg-stone-900 text-white font-semibold"
                      : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  Tüm Kategoriler
                </Link>
                {categories.map((cat) => {
                  const isActive = categoryHandle === cat.handle || categoryHandle === cat.id;
                  return (
                    <Link
                      key={cat.id}
                      href={createQueryUrl({ category: cat.handle, page: "1" })}
                      className={`block px-2.5 py-1.5 text-xs rounded-md transition ${
                        isActive
                          ? "bg-stone-900 text-white font-semibold"
                          : "text-stone-600 hover:bg-stone-100"
                      }`}
                    >
                      {cat.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* In-Stock Filter */}
            <div className="border-t border-stone-100 pt-4">
              <Link
                href={createQueryUrl({ in_stock: inStock ? undefined : "true", page: "1" })}
                className="flex items-center gap-2 text-xs font-medium text-stone-700 hover:text-stone-900 cursor-pointer"
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                    inStock ? "bg-stone-900 border-stone-900 text-white" : "border-stone-300"
                  }`}
                >
                  {inStock && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <span>Yalnızca Stokta Olanlar</span>
              </Link>
            </div>

            {/* Clear All Filters */}
            {(categoryHandle || inStock || minPrice !== undefined || maxPrice !== undefined) && (
              <div className="border-t border-stone-100 pt-4">
                <Link
                  href={`/ara?q=${encodeURIComponent(rawQ)}`}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold block text-center"
                >
                  Filtreleri Temizle
                </Link>
              </div>
            )}
          </div>
        </aside>

        {/* Results Grid / Empty State */}
        <div className="lg:col-span-3">
          {products.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                <Search className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">Sonuç Bulunamadı</h2>
              <p className="text-stone-500 text-sm max-w-md mx-auto mb-6">
                &ldquo;{rawQ}&rdquo; ile eşleşen ürün bulunamadı. Yazımı kontrol edebilir veya daha
                genel ifadeler deneyebilirsiniz.
              </p>

              {/* Suggestions */}
              <div className="border-t border-stone-100 pt-6 max-w-md mx-auto text-left">
                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                  Önerilen Aramalar:
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 6).map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/kategori/${cat.handle}`}
                      className="px-3 py-1 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-full transition"
                    >
                      {cat.name}
                    </Link>
                  ))}
                  <Link
                    href="/urunler"
                    className="px-3 py-1 text-xs font-medium bg-stone-900 text-white rounded-full hover:bg-stone-700 transition"
                  >
                    Tüm Koleksiyon →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12 pt-6 border-t border-stone-200">
                  {currentPage > 1 ? (
                    <Link
                      href={createQueryUrl({ page: String(currentPage - 1) })}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 hover:bg-stone-100 transition text-stone-700"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Önceki</span>
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-stone-100 text-stone-300 cursor-not-allowed">
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Önceki</span>
                    </span>
                  )}

                  <span className="text-xs font-semibold text-stone-700 px-3">
                    Sayfa {currentPage} / {totalPages}
                  </span>

                  {currentPage < totalPages ? (
                    <Link
                      href={createQueryUrl({ page: String(currentPage + 1) })}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-stone-200 hover:bg-stone-100 transition text-stone-700"
                    >
                      <span>Sonraki</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-stone-100 text-stone-300 cursor-not-allowed">
                      <span>Sonraki</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
