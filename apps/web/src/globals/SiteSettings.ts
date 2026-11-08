import type { GlobalConfig } from "payload";
import { canManageGlobals } from "../access/content";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Site Ayarları",
  access: {
    read: () => true,
    update: canManageGlobals,
  },
  fields: [
    {
      name: "storeName",
      type: "text",
      required: true,
      defaultValue: "Çisem Elif Boz",
      label: "Mağaza Adı",
    },
    {
      name: "storeDescription",
      type: "textarea",
      label: "Mağaza Açıklaması (Slogan)",
      defaultValue: "Özel tasarım ve kaliteli ürünlerin buluşma noktası.",
    },
    {
      name: "contactEmail",
      type: "email",
      label: "İletişim E-posta Adresi",
    },
    {
      name: "contactPhone",
      type: "text",
      label: "İletişim Telefonu",
    },
    {
      name: "address",
      type: "textarea",
      label: "Fiziki Mağaza / İletişim Adresi",
    },
    {
      name: "logo",
      type: "upload",
      relationTo: "media",
      label: "Site Logosu",
    },
    {
      name: "favicon",
      type: "upload",
      relationTo: "media",
      label: "Favicon",
    },
    {
      name: "socialMedia",
      type: "group",
      label: "Sosyal Medya Hesapları",
      fields: [
        {
          name: "instagram",
          type: "text",
          label: "Instagram URL (https://...)",
        },
        {
          name: "facebook",
          type: "text",
          label: "Facebook URL (https://...)",
        },
        {
          name: "twitter",
          type: "text",
          label: "X (Twitter) URL (https://...)",
        },
        {
          name: "youtube",
          type: "text",
          label: "YouTube URL (https://...)",
        },
      ],
    },
  ],
};
