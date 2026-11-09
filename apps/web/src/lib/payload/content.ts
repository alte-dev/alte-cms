import { getPayload } from "payload";
import configPromise from "@payload-config";

export async function getPayloadClient() {
  return await getPayload({ config: configPromise });
}

export async function getSiteSettings() {
  try {
    const payload = await getPayloadClient();
    const settings = await payload.findGlobal({
      slug: "site-settings",
    });
    return settings;
  } catch {
    return null;
  }
}

export async function getNavigation() {
  try {
    const payload = await getPayloadClient();
    const nav = await payload.findGlobal({
      slug: "navigation",
    });
    return nav;
  } catch {
    return null;
  }
}

export async function getPublishedHomePage() {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "pages",
      where: {
        and: [{ isHome: { equals: true } }, { _status: { equals: "published" } }],
      },
      limit: 1,
      depth: 1,
    });
    return result.docs[0] || null;
  } catch {
    return null;
  }
}

export async function getPublishedPageBySlug(slug: string) {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "pages",
      where: {
        and: [{ slug: { equals: slug } }, { _status: { equals: "published" } }],
      },
      limit: 1,
      depth: 1,
    });
    return result.docs[0] || null;
  } catch {
    return null;
  }
}

export async function getPublishedPosts(options?: {
  categorySlug?: string;
  page?: number;
  limit?: number;
}) {
  const page = options?.page || 1;
  const limit = options?.limit || 12;

  try {
    const payload = await getPayloadClient();
    const where: any = {
      _status: { equals: "published" },
    };

    if (options?.categorySlug) {
      // Find category ID first
      const catRes = await payload.find({
        collection: "post-categories",
        where: { slug: { equals: options.categorySlug } },
        limit: 1,
      });
      if (catRes.docs.length > 0) {
        where.categories = { contains: catRes.docs[0].id };
      } else {
        return { docs: [], totalDocs: 0, totalPages: 0, page: 1 };
      }
    }

    const result = await payload.find({
      collection: "posts",
      where,
      page,
      limit,
      sort: "-createdAt",
      depth: 1,
    });

    return result;
  } catch {
    return { docs: [], totalDocs: 0, totalPages: 0, page: 1 };
  }
}

export async function getPublishedPostBySlug(slug: string) {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "posts",
      where: {
        and: [{ slug: { equals: slug } }, { _status: { equals: "published" } }],
      },
      limit: 1,
      depth: 2,
    });
    return result.docs[0] || null;
  } catch {
    return null;
  }
}

export async function getAllPostCategories() {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "post-categories",
      limit: 100,
      sort: "title",
    });
    return result.docs;
  } catch {
    return [];
  }
}

export async function findRedirect(fromPath: string) {
  try {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: "redirects",
      where: {
        from: { equals: fromPath.toLowerCase() },
      },
      limit: 1,
    });
    return result.docs[0] || null;
  } catch {
    return null;
  }
}
