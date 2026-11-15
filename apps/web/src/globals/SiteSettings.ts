import type { GlobalConfig } from "payload";
import { canManageGlobals, isAdminRole } from "../access/content";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Site Ayarları",
  admin: {
    hidden: ({ user }) => !isAdminRole(user?.role as string | undefined),
  },
  access: {
    read: () => true,
    update: canManageGlobals,
  },
  fields: [
    {
      name: "storeName",
      type: "text",
      required: true,
      defaultValue: "Mağaza",
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
      name: "catalogListingMode",
      type: "select",
      label: "Ürün Listeleme Modu",
      defaultValue: "pagination",
      options: [
        { label: "Klasik Sayfalama (Pagination)", value: "pagination" },
        { label: "Sonsuz Kaydırma (Infinite Scroll)", value: "infinite" },
      ],
      admin: {
        description:
          "Vitrin ürünler ve kategori sayfalarında ürünlerin nasıl listeleneceğini belirler.",
      },
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
    {
      name: "contactForm",
      type: "group",
      label: "İletişim Formu Ayarları",
      fields: [
        {
          name: "enabled",
          type: "checkbox",
          defaultValue: true,
          label: "İletişim Formu Aktif",
        },
        {
          name: "recipientEmail",
          type: "email",
          label: "Bildirim Alıcı E-postası",
          admin: {
            description:
              "Yeni iletişim formu mesajlarının bildirileceği e-posta adresi. Boş bırakılırsa yukarıdaki İletişim E-posta Adresi kullanılır.",
          },
        },
        {
          name: "subjectOptions",
          type: "array",
          label: "Konu Seçenekleri",
          admin: {
            description:
              "Ziyaretçilerin formda seçebileceği konu başlıkları. Boş bırakılırsa serbest konu girişi gösterilir.",
          },
          fields: [
            {
              name: "label",
              type: "text",
              required: true,
              label: "Konu Başlığı",
            },
          ],
        },
        {
          name: "autoReplyEnabled",
          type: "checkbox",
          defaultValue: true,
          label: "Müşteriye Otomatik Onay E-postası Gönder",
        },
        {
          name: "autoReplySubject",
          type: "text",
          defaultValue: "Mesajınızı aldık",
          label: "Otomatik Yanıt E-posta Konusu",
        },
        {
          name: "autoReplyIntro",
          type: "textarea",
          defaultValue:
            "Mesajınız bize ulaştı. Ekibimiz talebinizi inceleyip en kısa sürede sizinle iletişime geçecektir.",
          label: "Otomatik Yanıt Karşılama Metni",
        },
        {
          name: "successMessage",
          type: "textarea",
          defaultValue: "Mesajınız başarıyla iletildi. En kısa sürede size dönüş yapacağız.",
          label: "Form Gönderim Başarı Mesajı",
        },
        {
          name: "pageTitle",
          type: "text",
          defaultValue: "Bizimle İletişime Geçin",
          label: "İletişim Sayfası Başlığı",
        },
        {
          name: "pageSubtitle",
          type: "textarea",
          defaultValue:
            "Sorularınız, siparişleriniz veya özel talepleriniz için bize her zaman ulaşabilirsiniz.",
          label: "İletişim Sayfası Alt Başlığı",
        },
        {
          name: "topContent",
          type: "textarea",
          label: "Form Üstü Metin / Duyuru (İsteğe Bağlı)",
          admin: {
            description: "İletişim formunun hemen üzerinde gösterilecek bilgilendirme metni.",
          },
        },
        {
          name: "bottomContent",
          type: "textarea",
          defaultValue:
            "Müşteri temsilcilerimiz ilettiğiniz tüm taleplere iş günleri içinde en geç 24 saat içerisinde dönüş yapmaktadır.",
          label: "Form Altı Metin / Bilgilendirme",
        },
        {
          name: "workingHours",
          type: "text",
          defaultValue: "Hafta içi: 09:00 - 18:00",
          label: "Çalışma Saatleri",
        },
        {
          name: "showMap",
          type: "checkbox",
          defaultValue: true,
          label: "Google Haritasını Göster",
        },
        {
          name: "mapQuery",
          type: "text",
          label: "Google Harita Konumu (Adres veya Koordinat)",
          admin: {
            description:
              "Örn: Nişantaşı, Şişli, İstanbul. Boş bırakılırsa mağaza adresi kullanılır.",
          },
        },
      ],
    },
  ],
};
