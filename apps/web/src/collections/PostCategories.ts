import type { CollectionConfig } from "payload";
import { slugify } from "../lib/slugify";
import { canCreateContent, canUpdateContent, canDeleteContent } from "../access/content";

export const PostCategories: CollectionConfig = {
  slug: "post-categories",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "updatedAt"],
  },
  access: {
    read: () => true,
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
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      label: "Kategori Başlığı",
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: "Kategori Kısa Adı (Slug)",
      admin: {
        description:
          "URL yolu için kullanılır (örn: rehber, ipuclari). Boş bırakılırsa başlıktan otomatik üretilir.",
      },
    },
    {
      name: "description",
      type: "textarea",
      label: "Açıklama",
    },
  ],
};
