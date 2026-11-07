import React from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Truck, RefreshCw } from "lucide-react";
import { getProducts, getCategories, getCollections } from "@/lib/medusa/products";
import { ProductCard } from "@/components/product-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [productsRes, categories, collections] = await Promise.all([
    getProducts({ limit: 8 }),
    getCategories(),
    getCollections(),
  ]);

  const products = productsRes.products;

  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl bg-stone-900 text-white overflow-hidden py-16 px-8 sm:px-16 shadow-xl">
          <div className="relative z-10 max-w-2xl space-y-6">
            <span className="inline-block px-3 py-1 bg-stone-800 text-stone-300 text-xs font-semibold rounded-full uppercase tracking-wider">
              Yeni Sezon 2026
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Zarafet ve Doğallığın Buluştuğu Koleksiyon
            </h1>
            <p className="text-stone-300 text-base sm:text-lg leading-relaxed">
              Özenle seçilmiş kumaşlar ve zamansız tasarımlar. Türkiye geneli hızlı teslimat ve KDV
              dahil net fiyatlar.
            </p>
            <div className="pt-2 flex flex-wrap gap-4">
              <Link
                href="/urunler"
                className="inline-flex items-center gap-2 bg-white text-stone-900 font-semibold px-6 py-3 rounded-lg hover:bg-stone-100 transition shadow-sm text-sm"
              >
                Koleksiyonu Keşfet
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/kategori/giyim"
                className="inline-flex items-center gap-2 bg-stone-800 text-white font-semibold px-6 py-3 rounded-lg hover:bg-stone-700 transition text-sm"
              >
                Giyim Ürünleri
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Badges */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900">1.500 TL Üzeri Ücretsiz Kargo</h4>
              <p className="text-xs text-stone-500">Tüm Türkiye'ye sigortalı ve hızlı teslimat</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900">Güvenli Alışveriş</h4>
              <p className="text-xs text-stone-500">
                256-bit SSL koruması ve şeffaf KDV dahil fiyatlar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center text-stone-800 shrink-0">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-900">Kolay İade ve Değişim</h4>
              <p className="text-xs text-stone-500">14 gün içinde koşulsuz iade imkanı</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-stone-900">Kategoriler</h2>
              <p className="text-sm text-stone-500 mt-1">İhtiyacınıza uygun ürün grubunu seçin</p>
            </div>
            <Link
              href="/urunler"
              className="text-sm font-semibold text-stone-700 hover:text-stone-900 inline-flex items-center gap-1"
            >
              Tümünü Gör <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/kategori/${cat.handle}`}
                className="group p-6 rounded-xl border border-stone-200 bg-white hover:border-stone-900 hover:shadow-md transition text-center flex flex-col items-center justify-center min-h-[140px]"
              >
                <span className="text-base font-bold text-stone-900 group-hover:text-stone-800 mb-1">
                  {cat.name}
                </span>
                {cat.description && (
                  <span className="text-xs text-stone-500 line-clamp-2">{cat.description}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">Yeni Gelenler</h2>
            <p className="text-sm text-stone-500 mt-1">En son eklenen seçkin parçalar</p>
          </div>
          <Link
            href="/urunler"
            className="text-sm font-semibold text-stone-700 hover:text-stone-900 inline-flex items-center gap-1"
          >
            Tüm Ürünler ({productsRes.count}) <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-stone-200 p-8">
            <p className="text-stone-500 text-sm">Şu an için listelenecek ürün bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
