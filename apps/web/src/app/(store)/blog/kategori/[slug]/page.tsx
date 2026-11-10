import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Pagination } from "@/components/pagination";
import { getPublishedPosts, getAllPostCategories, getSiteSettings } from "@/lib/payload/content";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [categories, settings] = await Promise.all([getAllPostCategories(), getSiteSettings()]);

  const cat = categories.find((c: any) => c.slug === slug);
  const storeName = settings?.storeName || "Mağaza";

  if (!cat) {
    return { title: `Kategori Bulunamadı | ${storeName}` };
  }

  return {
    title: `${cat.title} Yazıları | ${storeName}`,
    description: cat.description || `${cat.title} kategorisindeki blog yazıları.`,
  };
}

export default async function BlogCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page: pageStr } = await searchParams;
  const currentPage = parseInt(pageStr || "1", 10) || 1;

  const [categories, postsRes] = await Promise.all([
    getAllPostCategories(),
    getPublishedPosts({ categorySlug: slug, page: currentPage, limit: 12 }),
  ]);

  const currentCategory = categories.find((c: any) => c.slug === slug);
  if (!currentCategory) {
    notFound();
  }

  const posts = postsRes.docs;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Category Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Kategori
        </span>
        <h1 className="text-4xl font-extrabold text-zinc-900 tracking-tight sm:text-5xl mt-2">
          {currentCategory.title}
        </h1>
        {currentCategory.description && (
          <p className="mt-4 text-lg text-zinc-600">{currentCategory.description}</p>
        )}
      </div>

      {/* Category Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-10 border-b border-zinc-200">
        <Link
          href="/blog"
          className="px-4 py-2 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors shrink-0"
        >
          Tüm Yazılar
        </Link>
        {categories.map((cat: any) => {
          const isActive = cat.slug === slug;
          return (
            <Link
              key={cat.id}
              href={`/blog/kategori/${cat.slug}`}
              className={`px-4 py-2 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                isActive
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {cat.title}
            </Link>
          );
        })}
      </div>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div className="text-center py-16 bg-zinc-50 rounded-2xl border border-zinc-200">
          <p className="text-zinc-600">Bu kategoride henüz yayınlanmış yazı bulunmuyor.</p>
          <Link
            href="/blog"
            className="inline-block mt-4 text-xs font-semibold text-zinc-900 hover:underline"
          >
            &larr; Tüm Blog Yazılarına Dön
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post: any) => {
            const coverUrl = post.coverImage?.url;
            const coverAlt = post.coverImage?.alt || post.title;
            const authorName = post.author?.name || "Editör";
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
                className="group flex flex-col bg-white rounded-2xl border border-zinc-200 overflow-hidden hover:shadow-lg transition-all duration-200"
              >
                <Link
                  href={`/blog/${post.slug}`}
                  className="aspect-[16/9] bg-zinc-100 relative overflow-hidden block"
                >
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt={coverAlt || post.title}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-zinc-100">
                      <span className="text-xs font-medium">Görsel Yok</span>
                    </div>
                  )}
                </Link>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
                      <span>{dateStr}</span>
                      <span>•</span>
                      <span>{post.readingTime || 1} dk okuma</span>
                    </div>

                    <h2 className="text-xl font-bold text-zinc-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h2>

                    {post.excerpt && (
                      <p className="text-zinc-600 text-sm mt-3 line-clamp-3 leading-relaxed">
                        {post.excerpt}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-6 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                    <span>
                      Yazar: <strong className="text-zinc-700">{authorName}</strong>
                    </span>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="font-semibold text-zinc-900 hover:text-blue-600 transition"
                    >
                      Devamını Oku &rarr;
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={postsRes.totalPages}
        buildUrl={(p) => `/blog/kategori/${slug}?page=${p}`}
        className="mt-12"
      />
    </div>
  );
}
