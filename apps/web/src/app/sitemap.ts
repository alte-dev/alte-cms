import type { MetadataRoute } from "next";
import { getProducts, getCategories } from "@/lib/medusa/products";
import { getPayloadClient } from "@/lib/payload/content";

export const RESERVED_SLUGS = [
  "urunler",
  "urun",
  "kategori",
  "sepet",
  "odeme",
  "siparis-onay",
  "blog",
  "admin",
  "api",
  "sayfa",
  "onizleme",
  "ara",
  "siparis-takip",
];

export async function generateSitemaps() {
  // Splits sitemap into dedicated index partitions, each respecting the 50,000 URL limit:
  // 0: Main storefront routes & categories
  // 1: Product catalog
  // 2: CMS content (Pages, Blog Posts, Blog Categories)
  return [{ id: 0 }, { id: 1 }, { id: 2 }];
}

export default async function sitemap(props: {
  id: Promise<{ id: string }> | { id: string } | string;
}): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3100";

  // Resolve id safely across Next.js 15 variations
  let partitionId = 0;
  if (typeof props === "object" && props !== null) {
    const raw = (props as any).id;
    if (typeof raw === "number") {
      partitionId = raw;
    } else if (typeof raw === "string") {
      partitionId = parseInt(raw, 10) || 0;
    }
  }

  const urls: MetadataRoute.Sitemap = [];

  // Partition 0: Main Storefront & Product Categories
  if (partitionId === 0) {
    urls.push(
      {
        url: `${baseUrl}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1.0,
      },
      {
        url: `${baseUrl}/urunler`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      },
      {
        url: `${baseUrl}/blog`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.8,
      },
    );

    try {
      const categories = await getCategories();
      for (const cat of categories) {
        if (cat.handle && !RESERVED_SLUGS.includes(cat.handle)) {
          urls.push({
            url: `${baseUrl}/kategori/${cat.handle}`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
          });
        }
      }
    } catch {
      // Graceful fallback if service is offline
    }

    return urls;
  }

  // Partition 1: Medusa Products
  if (partitionId === 1) {
    try {
      const productsRes = await getProducts({ limit: 100 });
      for (const prod of productsRes.products) {
        if (prod.handle && !RESERVED_SLUGS.includes(prod.handle)) {
          const prodDate = (prod as any).updated_at
            ? new Date((prod as any).updated_at)
            : new Date();
          urls.push({
            url: `${baseUrl}/urun/${prod.handle}`,
            lastModified: prodDate,
            changeFrequency: "weekly",
            priority: 0.8,
          });
        }
      }
    } catch {
      // Graceful fallback if service is offline
    }

    return urls;
  }

  // Partition 2: Payload Pages & Blog Posts (strictly published, non-draft, noIndex excluded)
  if (partitionId === 2) {
    try {
      const payload = await getPayloadClient();

      // Pages
      const pagesRes = await payload.find({
        collection: "pages",
        where: {
          _status: { equals: "published" },
        },
        limit: 500,
        depth: 0,
      });

      for (const page of pagesRes.docs) {
        const isHome = Boolean(page.isHome || page.slug === "index");
        const noIndex = Boolean((page as any)?.seo?.noIndex);

        if (!isHome && !noIndex && page.slug && !RESERVED_SLUGS.includes(page.slug)) {
          urls.push({
            url: `${baseUrl}/sayfa/${page.slug}`,
            lastModified: page.updatedAt ? new Date(page.updatedAt) : new Date(),
            changeFrequency: "monthly",
            priority: 0.6,
          });
        }
      }

      // Blog Posts
      const postsRes = await payload.find({
        collection: "posts",
        where: {
          _status: { equals: "published" },
        },
        limit: 500,
        depth: 0,
      });

      for (const post of postsRes.docs) {
        const noIndex = Boolean((post as any)?.seo?.noIndex);
        if (!noIndex && post.slug && !RESERVED_SLUGS.includes(post.slug)) {
          urls.push({
            url: `${baseUrl}/blog/${post.slug}`,
            lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
          });
        }
      }

      // Blog Categories
      const catRes = await payload.find({
        collection: "post-categories",
        limit: 100,
        depth: 0,
      });

      for (const cat of catRes.docs) {
        if (cat.slug && !RESERVED_SLUGS.includes(cat.slug)) {
          urls.push({
            url: `${baseUrl}/blog/kategori/${cat.slug}`,
            lastModified: cat.updatedAt ? new Date(cat.updatedAt) : new Date(),
            changeFrequency: "weekly",
            priority: 0.6,
          });
        }
      }
    } catch {
      // Graceful fallback if service is offline
    }

    return urls;
  }

  return urls;
}
