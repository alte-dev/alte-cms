import type { GlobalConfig } from "payload";
import { canManageGlobals } from "../access/content";
import { validateSafeHrefField } from "../lib/safe-href";

export const Navigation: GlobalConfig = {
  slug: "navigation",
  label: "Menü ve Navigasyon",
  access: {
    read: () => true,
    update: canManageGlobals,
  },
  fields: [
    {
      name: "headerMenu",
      type: "array",
      label: "Üst Menü (Header)",
      labels: {
        singular: "Menü Öğesi",
        plural: "Menü Öğeleri",
      },
      fields: [
        {
          name: "label",
          type: "text",
          required: true,
          label: "Başlık / Metin",
        },
        {
          name: "href",
          type: "text",
          required: true,
          label: "Bağlantı Hedefi",
          validate: validateSafeHrefField,
          admin: {
            description: "İç yol (/blog, /sayfa/hakkimizda) veya güvenli dış bağlantı (https://...).",
          },
        },
        {
          name: "openInNewTab",
          type: "checkbox",
          defaultValue: false,
          label: "Yeni Sekmede Aç",
        },
        {
          name: "children",
          type: "array",
          label: "Alt Menü Öğeleri",
          labels: {
            singular: "Alt Öğe",
            plural: "Alt Öğeler",
          },
          fields: [
            {
              name: "label",
              type: "text",
              required: true,
              label: "Başlık / Metin",
            },
            {
              name: "href",
              type: "text",
              required: true,
              label: "Bağlantı Hedefi",
              validate: validateSafeHrefField,
            },
            {
              name: "openInNewTab",
              type: "checkbox",
              defaultValue: false,
              label: "Yeni Sekmede Aç",
            },
          ],
        },
      ],
    },
    {
      name: "footerMenu",
      type: "array",
      label: "Alt Menü (Footer Kolonları)",
      labels: {
        singular: "Footer Kolonu",
        plural: "Footer Kolonları",
      },
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          label: "Kolon Başlığı (örn: Kurumsal, Yardım, Hızlı Menü)",
        },
        {
          name: "items",
          type: "array",
          label: "Kolon Bağlantıları",
          labels: {
            singular: "Bağlantı",
            plural: "Bağlantılar",
          },
          fields: [
            {
              name: "label",
              type: "text",
              required: true,
              label: "Başlık / Metin",
            },
            {
              name: "href",
              type: "text",
              required: true,
              label: "Bağlantı Hedefi",
              validate: validateSafeHrefField,
            },
            {
              name: "openInNewTab",
              type: "checkbox",
              defaultValue: false,
              label: "Yeni Sekmede Aç",
            },
          ],
        },
      ],
    },
  ],
};
