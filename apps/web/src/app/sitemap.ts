import type { MetadataRoute } from "next";
import { getProducts, getCategories } from "@/lib/medusa/products";
import { getPayloadClient } from "@/lib/payload/content";

export async function generateSitemaps() {
  // Support for pagination (up to 50,000 URLs per sitemap chunk)
  return [{ id: 0 }];
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || "https://cisemelifboz.com";
  const urls: MetadataRoute.Sitemap = [];

  // 1. Static Storefront Pages
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

  // 2. Medusa Products & Categories
  try {
    const [productsRes, categories] = await Promise.all([
      getProducts({ limit: 100 }),
      getCategories(),
    ]);

    for (const prod of productsRes.products) {
      if (prod.handle) {
        const prodDate = (prod as any).updated_at ? new Date((prod as any).updated_at) : new Date();
        urls.push({
          url: `${baseUrl}/urun/${prod.handle}`,
          lastModified: prodDate,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }

    for (const cat of categories) {
      if (cat.handle) {
        urls.push({
          url: `${baseUrl}/kategori/${cat.handle}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // Graceful fallback if Medusa is starting up
  }

  // 3. Payload Pages (Published only, no drafts, exclude noIndex)
  try {
    const payload = await getPayloadClient();

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

      if (!isHome && !noIndex && page.slug) {
        urls.push({
          url: `${baseUrl}/sayfa/${page.slug}`,
          lastModified: page.updatedAt ? new Date(page.updatedAt) : new Date(),
          changeFrequency: "monthly",
          priority: 0.6,
        });
      }
    }

    // 4. Payload Blog Posts (Published only, no drafts, exclude noIndex)
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
      if (!noIndex && post.slug) {
        urls.push({
          url: `${baseUrl}/blog/${post.slug}`,
          lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }

    // 5. Blog Categories
    const catRes = await payload.find({
      collection: "post-categories",
      limit: 100,
      depth: 0,
    });

    for (const cat of catRes.docs) {
      if (cat.slug) {
        urls.push({
          url: `${baseUrl}/blog/kategori/${cat.slug}`,
          lastModified: cat.updatedAt ? new Date(cat.updatedAt) : new Date(),
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }
    }
  } catch {
    // Graceful fallback if Payload is initializing
  }

  return urls;
}
