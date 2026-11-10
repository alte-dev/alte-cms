import type { CollectionConfig } from "payload";
import { slugify, validateSlugField } from "../lib/slugify";
import { calculateReadingTime } from "../lib/reading-time";
import { seoGroup } from "../fields/seo";
import { revalidateContentTag, CACHE_TAGS } from "../lib/cache-tags";
import {
  canReadPublishedOnlyOrStaff,
  canCreateContent,
  canUpdateContent,
  canDeleteContent,
} from "../access/content";

export const Posts: CollectionConfig = {
  slug: "posts",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "author", "readingTime", "_status", "updatedAt"],
  },
  versions: {
    drafts: true,
  },
  access: {
    read: canReadPublishedOnlyOrStaff,
    create: canCreateContent,
    update: canUpdateContent,
    delete: canDeleteContent,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data && !data.slug && data.title) {
          data.slug = slugify(data.title);
        } else if (data && data.slug) {
          data.slug = slugify(data.slug);
        }
        return data;
      },
    ],
    beforeChange: [
      ({ req, data }) => {
        if (data) {
          // Calculate reading time from content
          if (data.content) {
            data.readingTime = calculateReadingTime(data.content);
          } else {
            data.readingTime = 1;
          }

          // Automatically assign author to logged-in user if not already set
          if (!data.author && req.user) {
            data.author = req.user.id;
          }
        }
        return data;
      },
    ],
    afterChange: [
      ({ doc }) => {
        revalidateContentTag(CACHE_TAGS.blog);
        if (doc?.slug) {
          revalidateContentTag(CACHE_TAGS.post(doc.slug));
        }
      },
    ],
    afterDelete: [
      ({ doc }) => {
        revalidateContentTag(CACHE_TAGS.blog);
        if (doc?.slug) {
          revalidateContentTag(CACHE_TAGS.post(doc.slug));
        }
      },
    ],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      label: "Yazı Başlığı",
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: "Yazı URL Yolu (Slug)",
      validate: (val: unknown) => validateSlugField(val),
      admin: {
        position: "sidebar",
        description: "Yazının URL adresi. Boş bırakılırsa başlıktan otomatik oluşturulur.",
      },
    },
    {
      name: "coverImage",
      type: "upload",
      relationTo: "media",
      label: "Kapak Görseli",
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "excerpt",
      type: "textarea",
      label: "Kısa Özet",
      admin: {
        description: "Blog listesinde ve sosyal paylaşımlarda görünecek kısa tanıtım metni.",
      },
    },
    {
      name: "content",
      type: "richText",
      label: "Yazı İçeriği",
    },
    {
      name: "categories",
      type: "relationship",
      relationTo: "post-categories",
      hasMany: true,
      label: "Kategoriler",
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      label: "Yazar",
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "readingTime",
      type: "number",
      label: "Okuma Süresi (Dakika)",
      admin: {
        position: "sidebar",
        readOnly: true,
      },
    },
    seoGroup,
  ],
};
