import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getProducts } from "@/lib/medusa/products";
import { ProductQuerySchema } from "@/lib/medusa/validation";
import { resolveCatalogPageRedirect } from "@/lib/pagination";
import { ProductCard } from "@/components/product-card";
import { Pagination } from "@/components/pagination";
import { InfiniteProductGrid } from "@/components/infinite-product-grid";
import { getSiteSettings } from "@/lib/payload/content";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return {
      title: "Kategori Bulunamadı",
    };
  }

  return {
    title: `${category.name} Modelleri ve Fiyatları`,
    description:
      category.description ||
      `${category.name} kategorisindeki en yeni ve kaliteli ürünler. KDV dahil fiyatlar.`,
  };
}

export const dynamic = "force-dynamic";

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const rawParams = await searchParams;

  const category = await getCategoryBySlug(slug);
  if (!category) {
    notFound();
  }

  const parsed = ProductQuerySchema.safeParse(rawParams);
  const query = parsed.success ? parsed.data : { page: 1, limit: 12, sort: "created_at" as const };

  const buildUrl = (newParams: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (query.sort && query.sort !== "created_at") p.set("sort", query.sort);
    if (query.page && query.page > 1) p.set("page", String(query.page));

    for (const [key, value] of Object.entries(newParams)) {
      if (value === undefined || value === "") {
        p.delete(key);
      } else {
        p.set(key, String(value));
      }
    }

    const qs = p.toString();
    return qs ? `/kategori/${slug}?${qs}` : `/kategori/${slug}`;
  };

  if (resolveCatalogPageRedirect(rawParams.page) === 1) {
    redirect(buildUrl({ page: undefined }));
  }

  const [productsRes, settings] = await Promise.all([
    getProducts({
      page: query.page,
      limit: query.limit,
      sort: query.sort,
      category_id: category.id,
      q: query.q,
    }),
    getSiteSettings(),
  ]);

  const { products, count, totalPages, currentPage } = productsRes;
  const isInfinite = settings?.catalogListingMode === "infinite";

  const targetPageRedirect = resolveCatalogPageRedirect(rawParams.page, totalPages);
  if (targetPageRedirect !== null) {
    redirect(buildUrl({ page: targetPageRedirect > 1 ? targetPageRedirect : undefined }));
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 overflow-x-hidden">
      {/* Category Header */}
      <div className="border-b border-stone-200 pb-6">
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-2">
          <Link href="/" className="hover:text-stone-900">
            Anasayfa
          </Link>
          <span>/</span>
          <Link href="/urunler" className="hover:text-stone-900">
            Kategoriler
          </Link>
          <span>/</span>
          <span className="text-stone-900 font-semibold">{category.name}</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">{category.name}</h1>
        {category.description && (
          <p className="text-sm text-stone-500 mt-2 max-w-2xl">{category.description}</p>
        )}
        <p className="text-xs text-stone-400 mt-2">
          Toplam {count} ürün listeleniyor • Fiyatlarımıza KDV dahildir.
        </p>
      </div>

      {/* Sorting Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
        <span className="text-xs text-stone-500 font-medium">{count} ürün</span>

        <div className="flex items-center gap-2">
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
          <h3 className="text-lg font-bold text-stone-800 mb-2">Bu Kategoride Ürün Bulunmuyor</h3>
          <p className="text-sm text-stone-500 mb-6">
            Yakında bu kategoriye yeni ürünler eklenecektir.
          </p>
          <Link
            href="/urunler"
            className="inline-flex items-center px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition"
          >
            Tüm Ürünleri İncele
          </Link>
        </div>
      ) : isInfinite ? (
        <InfiniteProductGrid
          initialProducts={products}
          initialPage={currentPage}
          totalPages={totalPages}
          category={slug}
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
