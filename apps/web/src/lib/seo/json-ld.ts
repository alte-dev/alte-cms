/**
 * Secure JSON-LD Serialization and Schema Generators
 * Replaces '<' with '\u003c' to prevent script injection / XSS vulnerabilities.
 */
export function safeJsonLdStringify(data: unknown): string {
  const json = JSON.stringify(data);
  // Strictly escape '<' to prevent breaking out of <script> tag
  return json.replace(/</g, "\\u003c");
}

export function generateJsonLdWebsite(name: string, url: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: `${url}/urunler?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  return safeJsonLdStringify(schema);
}

export function generateJsonLdOrganization(name: string, url: string, logo?: string): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name,
    url,
    ...(logo ? { logo } : {}),
  };
  return safeJsonLdStringify(schema);
}

export function generateJsonLdWebPage(params: {
  title: string;
  description?: string;
  url: string;
  datePublished?: string;
  dateModified?: string;
}): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: params.title,
    ...(params.description ? { description: params.description } : {}),
    url: params.url,
    ...(params.datePublished ? { datePublished: params.datePublished } : {}),
    ...(params.dateModified ? { dateModified: params.dateModified } : {}),
  };
  return safeJsonLdStringify(schema);
}

export function generateJsonLdBlogPosting(params: {
  headline: string;
  description?: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  publisherName?: string;
  publisherLogo?: string;
  imageUrl?: string;
}): string {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: params.headline,
    ...(params.description ? { description: params.description } : {}),
    url: params.url,
    datePublished: params.datePublished,
    dateModified: params.dateModified || params.datePublished,
    author: {
      "@type": "Person",
      name: params.authorName || "Editör",
    },
    publisher: {
      "@type": "Organization",
      name: params.publisherName || "Çisem Elif Boz",
      ...(params.publisherLogo
        ? { logo: { "@type": "ImageObject", url: params.publisherLogo } }
        : {}),
    },
    ...(params.imageUrl ? { image: params.imageUrl } : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": params.url,
    },
  };
  return safeJsonLdStringify(schema);
}
