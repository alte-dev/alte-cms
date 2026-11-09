import { notFound, redirect, RedirectType } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedPageBySlug, getSiteSettings, findRedirect } from "@/lib/payload/content";
import { RenderPuckContent } from "@/lib/puck/render";
import { safeParsePuckData } from "@/lib/puck/schema";
import { generateJsonLdWebPage } from "@/lib/seo/json-ld";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

const LEGAL_FALLBACK_SLUGS = ["kvkk", "mesafeli-satis-sozlesmesi"];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [pageDoc, settings] = await Promise.all([getPublishedPageBySlug(slug), getSiteSettings()]);
  const storeName = settings?.storeName || "Mağaza";

  if (!pageDoc || pageDoc._status !== "published") {
    if (LEGAL_FALLBACK_SLUGS.includes(slug)) {
      const legalTitle = slug === "kvkk" ? "KVKK Aydınlatma Metni" : "Mesafeli Satış Sözleşmesi";
      return {
        title: `${legalTitle} | ${storeName}`,
        robots: {
          index: false,
          follow: false,
        },
      };
    }
    return {
      title: `Sayfa Bulunamadı | ${storeName}`,
    };
  }

  const seo = pageDoc.seo;
  const title = seo?.metaTitle || `${pageDoc.title} | ${storeName}`;
  const description = seo?.metaDescription || settings?.storeDescription || "";
  const noIndex = Boolean(seo?.noIndex);

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
      type: "website",
      locale: "tr_TR",
      siteName: storeName,
    },
  };
}

export default async function DynamicStorePage({ params }: Props) {
  const { slug } = await params;
  const pageDoc = await getPublishedPageBySlug(slug);

  // If page is not found or not published, check for legal fallback or configured redirects
  if (!pageDoc || pageDoc._status !== "published") {
    if (LEGAL_FALLBACK_SLUGS.includes(slug)) {
      const legalTitle = slug === "kvkk" ? "KVKK Aydınlatma Metni" : "Mesafeli Satış Sözleşmesi";
      return (
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold mb-4 text-stone-900">{legalTitle}</h1>
          <p className="text-stone-600">Bu metin yakında yayınlanacaktır.</p>
        </div>
      );
    }

    const matchedRedirect =
      (await findRedirect(`/sayfa/${slug}`)) || (await findRedirect(`/${slug}`));

    if (matchedRedirect) {
      redirect(
        matchedRedirect.to,
        matchedRedirect.type === "302" ? RedirectType.push : RedirectType.replace,
      );
    }

    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3100";
  const pageUrl = `${baseUrl}/sayfa/${slug}`;

  const jsonLd = generateJsonLdWebPage({
    title: pageDoc.title || "Sayfa",
    description: pageDoc.seo?.metaDescription || undefined,
    url: pageUrl,
    datePublished: pageDoc.createdAt,
    dateModified: pageDoc.updatedAt,
  });

  const safePuck = safeParsePuckData(pageDoc.puckData);

  return (
    <article className="w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {safePuck ? (
        <RenderPuckContent data={safePuck} />
      ) : (
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-zinc-500">
          Bu sayfada henüz görüntülenecek içerik bulunmuyor.
        </div>
      )}
    </article>
  );
}
