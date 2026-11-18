import React from "react";
import Link from "next/link";
import Image from "next/image";
import { getProducts, getCategories } from "../medusa/products";
import { getPublishedPosts } from "../payload/content";
import { ProductCard } from "../../components/product-card";
import { safeHref } from "../safe-href";
import type {
  ProductGridProps,
  FeaturedProductsProps,
  CategoryListProps,
  LatestPostsProps,
} from "./components";

export async function ServerProductGridComponent({
  title = "Öne Çıkan Ürünler",
  limit = 4,
}: ProductGridProps) {
  const safeLimit = Math.min(Math.max(Number(limit) || 4, 1), 8);
  const { products } = await getProducts({ limit: safeLimit });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h2>
        <Link href="/urunler" className="text-sm font-semibold text-zinc-900 hover:underline">
          Tümünü Gör &rarr;
        </Link>
      </div>
      {products.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600 mb-3">Şu anda listelenecek ürün bulunmuyor.</p>
          <Link
            href="/urunler"
            className="inline-block text-sm font-semibold text-zinc-900 underline underline-offset-4"
          >
            Mağazaya Git
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

export async function ServerFeaturedProductsComponent({
  title = "Haftanın Seçimleri",
  subtitle = "En çok tercih edilen özel parçalar",
}: FeaturedProductsProps) {
  const { products } = await getProducts({ limit: 3 });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center max-w-xl mx-auto mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h2>
        {subtitle && <p className="text-zinc-600 mt-2">{subtitle}</p>}
      </div>
      {products.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <Link
            href="/urunler"
            className="text-sm font-semibold text-zinc-900 underline underline-offset-4"
          >
            Tüm Ürünleri İncele
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

export async function ServerCategoryListComponent({
  title = "Kategorilere Göz Atın",
}: CategoryListProps) {
  const categories = await getCategories();
  const fallbackCategories = [
    { name: "Tüm Ürünler", href: "/urunler" },
    { name: "Yeni Gelenler", href: "/urunler?sort=created_at" },
  ];

  const items =
    categories.length > 0
      ? categories.slice(0, 8).map((cat) => ({
          name: cat.name,
          href: `/kategori/${cat.handle}`,
        }))
      : fallbackCategories;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-8">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((cat, idx) => (
          <Link
            key={idx}
            href={safeHref(cat.href)}
            className="group relative rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
          >
            <span className="font-semibold text-base block">{cat.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export async function ServerLatestPostsComponent({
  title = "Blogdan Son Yazılar",
  limit = 3,
}: LatestPostsProps) {
  const safeLimit = Math.min(Math.max(Number(limit) || 3, 1), 6);
  const postsRes = await getPublishedPosts({ page: 1, limit: safeLimit });
  const posts = postsRes?.docs || [];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h2>
        <Link href="/blog" className="text-sm font-semibold text-zinc-900 hover:underline">
          Tüm Yazılar &rarr;
        </Link>
      </div>
      {posts.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-sm text-zinc-600 mb-3">
            Henüz yayınlanmış bir blog yazısı bulunmuyor.
          </p>
          <Link
            href="/blog"
            className="inline-block text-sm font-semibold text-zinc-900 underline underline-offset-4"
          >
            Blog Sayfasına Git
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {posts.map((post: any) => {
            const coverUrl = post.coverImage?.url;
            const coverAlt = post.coverImage?.alt || post.title;
            const postHref = safeHref(`/blog/${post.slug}`);
            const dateStr = post.createdAt
              ? new Date(post.createdAt).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "";

            return (
              <article
                key={post.id}
                className="group rounded-xl border border-zinc-200 bg-white overflow-hidden hover:border-zinc-400 hover:shadow-md transition-all flex flex-col"
              >
                <Link
                  href={postHref}
                  className="aspect-[16/9] bg-zinc-100 relative overflow-hidden block"
                >
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt={coverAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <span className="text-xs">Blog Görseli</span>
                    </div>
                  )}
                </Link>
                <div className="p-5 flex-1 flex flex-col">
                  {dateStr && <time className="text-xs text-zinc-500">{dateStr}</time>}
                  <h3 className="font-semibold text-lg text-zinc-900 mt-1 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                    <Link href={postHref}>{post.title}</Link>
                  </h3>
                  {post.excerpt && (
                    <p className="text-zinc-600 text-sm line-clamp-2 mb-4">{post.excerpt}</p>
                  )}
                  <Link
                    href={postHref}
                    className="mt-auto text-xs font-semibold text-zinc-900 hover:text-blue-600 transition"
                  >
                    Devamını Oku &rarr;
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
