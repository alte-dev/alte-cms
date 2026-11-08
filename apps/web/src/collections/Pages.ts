import type { CollectionConfig } from "payload";
import { slugify } from "../lib/slugify";
import { validatePuckData } from "../lib/puck/schema";
import { seoGroup } from "../fields/seo";
import {
  canReadPublishedOnlyOrStaff,
  canCreateContent,
  canUpdateContent,
  canDeleteContent,
} from "../access/content";

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "isHome", "_status", "updatedAt"],
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
        if (data) {
          if (data.isHome && (!data.slug || data.slug === "index" || data.slug === "home")) {
            data.slug = "index";
          } else if (!data.slug && data.title) {
            data.slug = slugify(data.title);
          } else if (data.slug) {
            data.slug = slugify(data.slug);
          }
        }
        return data;
      },
    ],
    beforeChange: [
      async ({ req, data, originalDoc }) => {
        if (data) {
          // Puck data security & structural validation
          if (data.puckData) {
            const validation = validatePuckData(data.puckData);
            if (!validation.valid) {
              throw new Error(`Güvenlik ve Şema Hatası (Puck): ${validation.error}`);
            }
          }

          // Single isHome page enforcement:
          // If this page is set as isHome, unset isHome on all other pages in the database
          if (data.isHome === true) {
            const currentId = originalDoc?.id;
            try {
              const otherHomePages = await req.payload.find({
                collection: "pages",
                where: {
                  isHome: { equals: true },
                },
                limit: 50,
                depth: 0,
              });

              for (const doc of otherHomePages.docs) {
                if (!currentId || doc.id !== currentId) {
                  await req.payload.update({
                    collection: "pages",
                    id: doc.id,
                    data: {
                      isHome: false,
                    },
                  });
                }
              }
            } catch (err) {
              // Log error or proceed if table is not yet initialized during migration
              req.payload.logger.warn({
                msg: "Could not unset isHome on existing pages (may be initializing)",
                err,
              });
            }
          }
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: "openPuck",
      type: "ui",
      admin: {
        position: "sidebar",
        components: {
          Field: "@/components/puck/PuckEditorButton#PuckEditorButton",
        },
      },
    },
    {
      name: "title",
      type: "text",
      required: true,
      label: "Sayfa Başlığı",
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: "Sayfa URL Yolu (Slug)",
      admin: {
        position: "sidebar",
        description:
          "Sayfa bağlantısı (örn: hakkimizda, iletisim). Ana sayfa için 'index' kullanılır.",
      },
    },
    {
      name: "isHome",
      type: "checkbox",
      defaultValue: false,
      label: "Ana Sayfa Olarak Kullan",
      admin: {
        position: "sidebar",
        description:
          "İşaretlenirse sitenin ana sayfası (/) bu içerik ile oluşturulur. Sistemde yalnızca bir ana sayfa olabilir.",
      },
    },
    {
      name: "puckData",
      type: "json",
      label: "Görsel Düzenleyici Verisi (Puck)",
      admin: {
        description: "Puck görsel sayfa oluşturucu verisi.",
      },
    },
    seoGroup,
  ],
};
