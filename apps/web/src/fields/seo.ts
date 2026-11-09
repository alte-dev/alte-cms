import type { Field } from "payload";
import { validateSafeHrefField } from "../lib/safe-href";

export const seoFields: Field = {
  name: "seo",
  type: "group",
  label: "SEO Ayarları",
  fields: [
    {
      name: "metaTitle",
      type: "text",
      label: "Sayfa Başlığı (Meta Title)",
      admin: {
        description:
          "Arama motorlarında ve tarayıcı sekmesinde görünen başlık. Önerilen maksimum uzunluk: 60 karakter.",
      },
    },
    {
      name: "metaDescription",
      type: "textarea",
      label: "Sayfa Açıklaması (Meta Description)",
      admin: {
        description:
          "Arama motoru sonuçlarında başlığın altında görünen özet. Önerilen maksimum uzunluk: 160 karakter.",
      },
    },
    {
      name: "ogImage",
      type: "upload",
      relationTo: "media",
      label: "Sosyal Medya Paylaşım Görseli (Open Graph Image)",
      admin: {
        description:
          "Sosyal medyada paylaşıldığında kartta görüntülenecek 1200x630 önerilen görsel.",
      },
    },
    {
      name: "canonicalUrl",
      type: "text",
      label: "Kanonik URL (Canonical URL)",
      validate: validateSafeHrefField,
      admin: {
        description:
          "Opsiyonel. Kopya içerik durumlarında asıl kaynağı belirtir. Sadece 'https://' kabul edilir.",
      },
    },
    {
      name: "noIndex",
      type: "checkbox",
      label: "Arama Motorlarından Gizle (noindex)",
      defaultValue: false,
      admin: {
        description:
          "İşaretlenirse arama motorlarının bu sayfayı indekslemesi engellenir (robots: noindex).",
      },
    },
  ],
};

export const seoGroup = seoFields;
