import { notFound, redirect, RedirectType } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedPageBySlug, getSiteSettings, findRedirect } from "@/lib/payload/content";
import { RenderPuckContent } from "@/lib/puck/render";
import { generateJsonLdWebPage } from "@/lib/seo/json-ld";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [pageDoc, settings] = await Promise.all([getPublishedPageBySlug(slug), getSiteSettings()]);

  if (!pageDoc) {
    return {
      title: "Sayfa Bulunamadı | Çisem Elif Boz",
    };
  }

  const storeName = settings?.storeName || "Çisem Elif Boz";
  const seo = (pageDoc as any)?.seo;
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

  // If page is not found or not published, check for configured redirects
  if (!pageDoc || (pageDoc as any)._status !== "published") {
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

  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "https://cisemelifboz.com";
  const pageUrl = `${baseUrl}/sayfa/${slug}`;

  const jsonLd = generateJsonLdWebPage({
    title: pageDoc.title || "Sayfa",
    description: (pageDoc as any)?.seo?.metaDescription,
    url: pageUrl,
    datePublished: pageDoc.createdAt,
    dateModified: pageDoc.updatedAt,
  });

  return (
    <article className="w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <RenderPuckContent data={pageDoc.puckData} />
    </article>
  );
}
