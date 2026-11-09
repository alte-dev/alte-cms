import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedPostBySlug, getSiteSettings } from "@/lib/payload/content";
import { LexicalRenderer } from "@/components/blog/LexicalRenderer";
import { generateJsonLdBlogPosting } from "@/lib/seo/json-ld";
import {
  isPopulatedMedia,
  isPopulatedUser,
  getPopulatedCategories,
} from "@/lib/payload/relationships";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [post, settings] = await Promise.all([getPublishedPostBySlug(slug), getSiteSettings()]);

  if (!post) {
    return { title: "Yazı Bulunamadı | Mağaza" };
  }

  const storeName = settings?.storeName || "Mağaza";
  const seo = post.seo;
  const title = seo?.metaTitle || `${post.title} | ${storeName}`;
  const description = seo?.metaDescription || post.excerpt || "";
  const noIndex = Boolean(seo?.noIndex);
  const coverMedia = isPopulatedMedia(post.coverImage) ? post.coverImage : null;
  const coverUrl = coverMedia?.url || undefined;

  return {
    title,
    description,
    robots: {
      index: !noIndex,
      follow: !noIndex,
    },
    alternates: seo?.canonicalUrl ? { canonical: seo.canonicalUrl } : undefined,
    openGraph: {
      title,
      description,
      type: "article",
      locale: "tr_TR",
      siteName: storeName,
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, settings] = await Promise.all([getPublishedPostBySlug(slug), getSiteSettings()]);

  // Drafts or missing posts return 404
  if (!post || post._status !== "published") {
    notFound();
  }

  const storeName = settings?.storeName || "Mağaza";
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3100";
  const postUrl = `${baseUrl}/blog/${slug}`;

  // Safe author name (author email is NEVER accessed or rendered)
  const authorDoc = isPopulatedUser(post.author) ? post.author : null;
  const authorName = authorDoc?.name || "Editör";

  const coverMedia = isPopulatedMedia(post.coverImage) ? post.coverImage : null;
  const coverUrl = coverMedia?.url || null;
  const coverAlt = coverMedia?.alt || post.title;

  const categories = getPopulatedCategories(post.categories);

  const dateStr = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const jsonLd = generateJsonLdBlogPosting({
    headline: post.title,
    description: post.excerpt || "",
    url: postUrl,
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    authorName,
    publisherName: storeName,
    imageUrl: coverUrl || undefined,
  });

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* JSON-LD Script */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* Back button & Categories */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          href="/blog"
          className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition flex items-center gap-1"
        >
          &larr; Tüm Blog Yazıları
        </Link>

        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/blog/kategori/${cat.slug}`}
                className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition"
              >
                {cat.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Post Title */}
      <h1 className="text-3xl sm:text-5xl font-extrabold text-zinc-900 tracking-tight leading-tight mb-6">
        {post.title}
      </h1>

      {/* Meta Bar */}
      <div className="flex items-center gap-4 text-sm text-zinc-600 pb-8 mb-8 border-b border-zinc-200">
        <div>
          <span>Yazar: </span>
          <strong className="text-zinc-900">{authorName}</strong>
        </div>
        <span>•</span>
        <time dateTime={post.createdAt}>{dateStr}</time>
        <span>•</span>
        <span>{post.readingTime || 1} dk tahmini okuma süresi</span>
      </div>

      {/* Cover Image */}
      {coverUrl && (
        <figure className="mb-10 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
          <img src={coverUrl} alt={coverAlt} className="w-full object-cover max-h-[550px]" />
        </figure>
      )}

      {/* Excerpt Lead */}
      {post.excerpt && (
        <p className="text-lg sm:text-xl text-zinc-700 font-medium leading-relaxed mb-8 italic border-l-4 border-zinc-900 pl-4 py-1">
          {post.excerpt}
        </p>
      )}

      {/* Rich Text Body */}
      <div className="text-zinc-800 leading-relaxed text-base sm:text-lg">
        <LexicalRenderer content={post.content} />
      </div>

      {/* Footer Share / Back */}
      <div className="mt-16 pt-8 border-t border-zinc-200 flex items-center justify-between">
        <Link
          href="/blog"
          className="text-sm font-semibold text-zinc-900 hover:text-blue-600 transition"
        >
          &larr; Blog Anasayfasına Dön
        </Link>
        <span className="text-xs text-zinc-500">{storeName} Blog</span>
      </div>
    </article>
  );
}
