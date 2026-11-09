import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedPosts, getAllPostCategories, getSiteSettings } from "@/lib/payload/content";
import { safeHref } from "@/lib/safe-href";

interface Props {
  searchParams: Promise<{ page?: string; q?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const storeName = settings?.storeName || "Mağaza";

  return {
    title: `Blog | ${storeName}`,
    description: `${storeName} resmi blogu: stil önerileri, yeni sezon trendleri ve moda ipuçları.`,
    openGraph: {
      title: `Blog | ${storeName}`,
      description: `${storeName} resmi blogu: stil önerileri, yeni sezon trendleri ve moda ipuçları.`,
      type: "website",
    },
  };
}

export default async function BlogIndexPage({ searchParams }: Props) {
  const { page: pageStr, q } = await searchParams;
  const currentPage = parseInt(pageStr || "1", 10) || 1;

  const [postsRes, categories] = await Promise.all([
    getPublishedPosts({ page: currentPage, limit: 12 }),
    getAllPostCategories(),
  ]);

  let posts = postsRes.docs;
  if (q && q.trim()) {
    const query = q.toLowerCase().trim();
    posts = posts.filter(
      (p: any) =>
        p.title?.toLowerCase().includes(query) || p.excerpt?.toLowerCase().includes(query),
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Blog Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl font-extrabold text-zinc-900 tracking-tight sm:text-5xl">
          Blog & Yaşam
        </h1>
        <p className="mt-4 text-lg text-zinc-600">Moda, stil ipuçları ve koleksiyon hikayeleri.</p>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 pb-6 border-b border-zinc-200">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          <Link
            href="/blog"
            className="px-4 py-2 rounded-full text-xs font-semibold bg-zinc-900 text-white shrink-0 shadow-sm"
          >
            Tümü
          </Link>
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              href={`/blog/kategori/${cat.slug}`}
              className="px-4 py-2 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition-colors shrink-0"
            >
              {cat.title}
            </Link>
          ))}
        </div>

        {/* Search */}
        <form method="GET" action="/blog" className="w-full sm:w-64">
          <input
            type="search"
            name="q"
            defaultValue={q || ""}
            placeholder="Blogda ara..."
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
          />
        </form>
      </div>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div className="text-center py-16 bg-zinc-50 rounded-2xl border border-zinc-200">
          <p className="text-zinc-600">Henüz yayınlanmış bir blog yazısı bulunmuyor.</p>
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
                {/* Cover Image */}
                <Link
                  href={`/blog/${post.slug}`}
                  className="aspect-[16/9] bg-zinc-100 relative overflow-hidden block"
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={coverAlt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 bg-zinc-100">
                      <span className="text-xs">Görsel Yok</span>
                    </div>
                  )}
                </Link>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Meta bar */}
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

                  {/* Author */}
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
      {postsRes.totalPages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          {Array.from({ length: postsRes.totalPages }).map((_, idx) => {
            const pageNum = idx + 1;
            const isCurrent = pageNum === currentPage;
            return (
              <Link
                key={pageNum}
                href={`/blog?page=${pageNum}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold transition ${
                  isCurrent
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {pageNum}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
