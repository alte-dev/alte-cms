import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ShieldCheck, Truck, RefreshCw } from "lucide-react";
import { getProducts, getCategories, getCollections } from "@/lib/medusa/products";
import { ProductCard } from "@/components/product-card";
import { getPublishedHomePage, getSiteSettings } from "@/lib/payload/content";
import { RenderPuckContent } from "@/lib/puck/render";
import { safeParsePuckData } from "@/lib/puck/schema";
import { generateJsonLdWebsite, generateJsonLdOrganization } from "@/lib/seo/json-ld";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [homePage, settings] = await Promise.all([getPublishedHomePage(), getSiteSettings()]);

  const storeName = settings?.storeName || "Mağaza";
  const defaultDesc =
    settings?.storeDescription ||
    "Özenle tasarlanmış giyim, aksesuar ve yaşam ürünleri. Türkiye geneli hızlı teslimat ve güvenli ödeme.";

  const title = homePage?.seo?.metaTitle || `${storeName} | Resmi Mağaza`;
  const description = homePage?.seo?.metaDescription || defaultDesc;
  const noIndex = Boolean(homePage?.seo?.noIndex);

  return {
    title,
    description,
    robots: {
      index: !noIndex,
      follow: !noIndex,
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "tr_TR",
      siteName: storeName,
    },
  };
}

export default async function HomePage() {
  const [homePage, settings] = await Promise.all([getPublishedHomePage(), getSiteSettings()]);

  const storeName = settings?.storeName || "Mağaza";
  const storeUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3100";

  const jsonLdWebsite = generateJsonLdWebsite(storeName, storeUrl);
  const jsonLdOrg = generateJsonLdOrganization(storeName, storeUrl);

  // If a published isHome page exists with valid Puck content, render it via Puck
  const safePuck = safeParsePuckData(homePage?.puckData);
  if (safePuck) {
    return (
      <div className="w-full">
        {/* JSON-LD Structured Data */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWebsite }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdOrg }} />
        <RenderPuckContent data={safePuck} />
      </div>
    );
  }

  // Fallback to default storefront home page
  const [productsRes, categories, collections] = await Promise.all([
    getProducts({ limit: 8 }),
    getCategories(),
    getCollections(),
  ]);

  const products = productsRes.products;

  return (
    <div className="space-y-16 py-8">
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWebsite }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdOrg }} />

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

      {/* Trust Badges */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-y border-stone-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-stone-100 rounded-lg text-stone-800">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-stone-900 text-sm">Hızlı ve Güvenli Kargo</h4>
              <p className="text-stone-500 text-xs mt-0.5">Tüm Türkiye'ye sigortalı gönderim</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-stone-100 rounded-lg text-stone-800">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-stone-900 text-sm">KDV Dahil Şeffaf Fiyatlar</h4>
              <p className="text-stone-500 text-xs mt-0.5">Gizli ücret veya ek maliyet yok</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-stone-100 rounded-lg text-stone-800">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-semibold text-stone-900 text-sm">Kolay İade ve Değişim</h4>
              <p className="text-stone-500 text-xs mt-0.5">14 gün içinde koşulsuz iade hakkı</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900">Öne Çıkan Ürünler</h2>
            <p className="text-sm text-stone-500 mt-1">
              En çok tercih edilen ve yeni eklenen tasarımlar
            </p>
          </div>
          <Link
            href="/urunler"
            className="text-sm font-semibold text-stone-800 hover:text-stone-600 flex items-center gap-1 transition"
          >
            Tümünü Gör
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-xl border border-stone-200">
            <p className="text-stone-500">Henüz ürün eklenmemiş.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Categories Grid */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900 mb-8">Kategoriler</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/kategori/${category.handle}`}
                className="group p-6 bg-stone-50 hover:bg-stone-900 rounded-xl border border-stone-200 transition duration-200 text-center flex flex-col items-center justify-center min-h-[120px]"
              >
                <h3 className="font-semibold text-stone-900 group-hover:text-white transition text-base">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-xs text-stone-500 group-hover:text-stone-300 mt-1 line-clamp-1 transition">
                    {category.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Collections Banner */}
      {collections.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-stone-100 rounded-2xl p-8 border border-stone-200">
            <h3 className="text-xl font-bold text-stone-900 mb-4">Özel Koleksiyonlar</h3>
            <div className="flex flex-wrap gap-3">
              {collections.map((col) => (
                <span
                  key={col.id}
                  className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-stone-800 border border-stone-200 shadow-sm"
                >
                  {col.title}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
