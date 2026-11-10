import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductByHandle } from "@/lib/medusa/products";
import { AddToCartForm } from "@/components/add-to-cart-button";
import { PlaceholderImage } from "@/components/placeholder-image";
import { getSiteSettings } from "@/lib/payload/content";
import { generateJsonLdProduct, generateJsonLdBreadcrumbs } from "@/lib/seo/json-ld";

interface ProductPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) {
    return {
      title: "Ürün Bulunamadı",
    };
  }

  const defaultVariant = product.variants?.[0];
  const price =
    defaultVariant?.calculated_price?.calculated_amount ?? defaultVariant?.prices?.[0]?.amount ?? 0;

  const isOutOfStock =
    defaultVariant?.manage_inventory &&
    !defaultVariant?.allow_backorder &&
    defaultVariant?.inventory_quantity !== undefined &&
    defaultVariant.inventory_quantity <= 0;

  const settings = await getSiteSettings().catch(() => null);
  const storeName = settings?.storeName || "Mağaza";

  return {
    title: product.title,
    description: product.description || `${product.title} - ${storeName}. KDV dahil fiyatlar.`,
    openGraph: {
      title: product.title,
      description: product.description || undefined,
      type: "website",
      siteName: storeName,
      locale: "tr_TR",
      ...(product.thumbnail ? { images: [{ url: product.thumbnail }] } : {}),
    },
    other: {
      "product:price:amount": String(price),
      "product:price:currency": "TRY",
      "product:availability": isOutOfStock ? "out of stock" : "in stock",
    },
  };
}

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) {
    notFound();
  }

  const primaryVariant = product.variants?.[0];
  const primaryPrice =
    primaryVariant?.calculated_price?.calculated_amount ?? primaryVariant?.prices?.[0]?.amount ?? 0;

  const isOutOfStock =
    primaryVariant?.manage_inventory &&
    !primaryVariant?.allow_backorder &&
    primaryVariant?.inventory_quantity !== undefined &&
    primaryVariant.inventory_quantity <= 0;

  const settings = await getSiteSettings().catch(() => null);
  const storeName = settings?.storeName || "Mağaza";
  const baseUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3100";
  const productUrl = `${baseUrl}/urun/${product.handle}`;

  const productJsonLd = generateJsonLdProduct({
    name: product.title,
    description: product.description || product.title,
    url: productUrl,
    imageUrl: product.thumbnail || undefined,
    price: primaryPrice,
    currency: "TRY",
    inStock: !isOutOfStock,
    brandName: storeName,
  });

  const breadcrumbsJsonLd = generateJsonLdBreadcrumbs([
    { name: "Anasayfa", item: baseUrl },
    { name: "Ürünler", item: `${baseUrl}/urunler` },
    { name: product.title, item: productUrl },
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* JSON-LD Scripts */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbsJsonLd }} />

      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Ekmek kırıntısı gezinimi"
        className="flex items-center gap-2 text-xs text-stone-500"
      >
        <Link href="/" className="hover:text-stone-900">
          Anasayfa
        </Link>
        <span>/</span>
        <Link href="/urunler" className="hover:text-stone-900">
          Ürünler
        </Link>
        {product.categories?.[0] && (
          <>
            <span>/</span>
            <Link
              href={`/kategori/${product.categories[0].handle}`}
              className="hover:text-stone-900"
            >
              {product.categories[0].name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-stone-900 font-semibold truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main Grid: Gallery & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Gallery / Image Area */}
        <div className="space-y-4">
          <div className="aspect-square bg-stone-100 rounded-2xl overflow-hidden border border-stone-200">
            {product.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.thumbnail}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <PlaceholderImage title={product.title} className="w-full h-full" />
            )}
          </div>

          {/* Secondary Images if available */}
          {product.images && product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-4">
              {product.images.slice(0, 4).map((img, i) => (
                <div
                  key={img.id || i}
                  className="aspect-square bg-stone-100 rounded-lg overflow-hidden border border-stone-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={`${product.title} - Görsel ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Purchase Form */}
        <div className="space-y-6">
          <div>
            {product.categories?.[0] && (
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                {product.categories[0].name}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 mt-1">
              {product.title}
            </h1>
            {product.subtitle && <p className="text-sm text-stone-500 mt-1">{product.subtitle}</p>}
          </div>

          {/* Add to Cart Client Component (Options, Stock, Price) */}
          <AddToCartForm product={product} />

          {/* Product Description */}
          {product.description && (
            <div className="pt-6 border-t border-stone-200 space-y-3">
              <h3 className="text-sm font-bold text-stone-900">Ürün Açıklaması</h3>
              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Delivery & Security Note */}
          <div className="p-4 bg-stone-100 rounded-xl space-y-2 text-xs text-stone-600">
            <p>
              📦 <strong>1.500 TL üzeri</strong> siparişlerde kargo ücretsizdir.
            </p>
            <p>
              🔒 <strong>Güvenli Ödeme:</strong> PayTR 3D Secure ve Kapıda Ödeme altyapısı.
            </p>
            <p>
              🧾 Fiyatlarımıza yasal <strong>KDV dahildir</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
