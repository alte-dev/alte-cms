import { revalidatePath } from "next/cache";
import type { Field, GlobalConfig } from "payload";
import { canManageGlobals, isAdminRole } from "../access/content";
import { CACHE_TAGS, revalidateContentTag } from "../lib/cache-tags";
import { DEFAULT_THEME_SETTINGS, isValidHexColor } from "../lib/theme/css-vars";

function colorField(
  name: string,
  label: string,
  defaultValue: string,
  description?: string,
): Field {
  return {
    name,
    type: "text",
    label,
    defaultValue,
    validate: (val: unknown) => {
      if (val === undefined || val === null || val === "") return true;
      if (isValidHexColor(val)) return true;
      return "Geçerli bir 6 haneli HEX renk kodu girin (ör. #3A4A5B).";
    },
    admin: {
      description: description
        ? `${description} (Varsayılan: ${defaultValue})`
        : `Varsayılan: ${defaultValue}`,
      placeholder: defaultValue,
      components: {
        Field: "@/components/admin/ColorField#ColorField",
      },
    },
  };
}

export const ThemeSettings: GlobalConfig = {
  slug: "theme-settings",
  label: "Tema ve Görünüm",
  admin: {
    group: "Tasarım ve Görünüm",
    hidden: ({ user }) => !isAdminRole(user?.role as string | undefined),
    description:
      "Mağaza renk paleti, yazı tipi, buton şekilleri ve ödeme ekranı görünümünü buradan özelleştirebilirsiniz.",
  },
  access: {
    read: () => true,
    update: canManageGlobals,
  },
  hooks: {
    afterChange: [
      ({ doc }) => {
        revalidateContentTag(CACHE_TAGS.settings);
        try {
          revalidatePath("/", "layout");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "";
          if (!msg.includes("static generation store missing")) {
            throw err;
          }
        }
        return doc;
      },
    ],
  },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Renk Paleti",
          description: "Mağaza genelindeki marka, buton, yüzey ve metin renklerini yönetin.",
          fields: [
            {
              name: "colors",
              type: "group",
              label: "Genel Mağaza Renkleri",
              fields: [
                {
                  type: "row",
                  fields: [
                    colorField(
                      "primaryColor",
                      "Ana Buton & Marka Rengi",
                      DEFAULT_THEME_SETTINGS.primaryColor,
                      "Sepete Ekle, Ödemeye Geç ve tüm ana aksiyon butonlarının rengi.",
                    ),
                    colorField(
                      "primaryHoverColor",
                      "Ana Buton Hover Rengi",
                      DEFAULT_THEME_SETTINGS.primaryHoverColor,
                      "Butonların üzerine gelindiğindeki koyu/soft ton.",
                    ),
                    colorField(
                      "primaryTextColor",
                      "Ana Buton Yazı Rengi",
                      DEFAULT_THEME_SETTINGS.primaryTextColor,
                      "Ana butonların üzerindeki metin rengi.",
                    ),
                    colorField(
                      "accentColor",
                      "İkincil Aksan Rengi",
                      DEFAULT_THEME_SETTINGS.accentColor,
                      "Vurgu ve ikincil etkileşim alanları.",
                    ),
                  ],
                },
                {
                  type: "row",
                  fields: [
                    colorField(
                      "backgroundColor",
                      "Sayfa Arka Planı",
                      DEFAULT_THEME_SETTINGS.backgroundColor,
                      "Mağaza sayfalarının genel arka plan rengi.",
                    ),
                    colorField(
                      "surfaceColor",
                      "Kart & Panel Yüzeyi",
                      DEFAULT_THEME_SETTINGS.surfaceColor,
                      "Ürün kartları, sepet ve form kutularının arka planı.",
                    ),
                    colorField(
                      "surfaceSubduedColor",
                      "Soft İkincil Yüzey",
                      DEFAULT_THEME_SETTINGS.surfaceSubduedColor,
                      "İkincil kutular ve vurgu zeminleri.",
                    ),
                    colorField(
                      "borderColor",
                      "Kenarlık & Ayırıcı Rengi",
                      DEFAULT_THEME_SETTINGS.borderColor,
                      "Kart, input ve bölüm çizgileri.",
                    ),
                  ],
                },
                {
                  type: "row",
                  fields: [
                    colorField(
                      "textColor",
                      "Ana Metin Rengi",
                      DEFAULT_THEME_SETTINGS.textColor,
                      "Başlık ve gövde yazılarının rengi.",
                    ),
                    colorField(
                      "textMutedColor",
                      "İkincil / Soluk Metin Rengi",
                      DEFAULT_THEME_SETTINGS.textMutedColor,
                      "Alt başlıklar, açıklamalar ve yardımcı metinler.",
                    ),
                  ],
                },
                {
                  type: "row",
                  fields: [
                    colorField(
                      "announcementBgColor",
                      "Üst Duyuru Bandı Arka Planı",
                      DEFAULT_THEME_SETTINGS.announcementBgColor,
                    ),
                    colorField(
                      "announcementTextColor",
                      "Üst Duyuru Bandı Yazı Rengi",
                      DEFAULT_THEME_SETTINGS.announcementTextColor,
                    ),
                    colorField(
                      "headerBgColor",
                      "Header Arka Planı",
                      DEFAULT_THEME_SETTINGS.headerBgColor,
                    ),
                  ],
                },
                {
                  type: "row",
                  fields: [
                    colorField(
                      "footerBgColor",
                      "Footer Arka Planı",
                      DEFAULT_THEME_SETTINGS.footerBgColor,
                    ),
                    colorField(
                      "footerTextColor",
                      "Footer Yazı Rengi",
                      DEFAULT_THEME_SETTINGS.footerTextColor,
                    ),
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "Tipografi & Yazı Stili",
          description: "Yazı tipi ailesi, boyut, başlık ağırlığı ve satır aralığı ayarları.",
          fields: [
            {
              name: "typography",
              type: "group",
              label: "Yazı Tipi ve Ölçek",
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "fontFamily",
                      type: "select",
                      label: "Gövde Yazı Tipi",
                      defaultValue: DEFAULT_THEME_SETTINGS.fontFamily,
                      options: [
                        { label: "Inter (Modern Sans)", value: "inter" },
                        { label: "Sistem Sans-Serif", value: "system" },
                        { label: "Klasik Serif (Georgia)", value: "serif" },
                        { label: "Monospace", value: "mono" },
                      ],
                    },
                    {
                      name: "headingFontFamily",
                      type: "select",
                      label: "Başlık Yazı Tipi",
                      defaultValue: DEFAULT_THEME_SETTINGS.headingFontFamily,
                      options: [
                        { label: "Gövdeyle Aynı", value: "inherit" },
                        { label: "Inter (Modern Sans)", value: "inter" },
                        { label: "Klasik Serif (Georgia)", value: "serif" },
                        { label: "Sistem Sans-Serif", value: "system" },
                      ],
                    },
                    {
                      name: "baseFontSize",
                      type: "select",
                      label: "Temel Yazı Boyutu",
                      defaultValue: DEFAULT_THEME_SETTINGS.baseFontSize,
                      options: [
                        { label: "Küçük (14px)", value: "14px" },
                        { label: "Orta-Küçük (15px)", value: "15px" },
                        { label: "Standart (16px)", value: "16px" },
                        { label: "Büyük (17px)", value: "17px" },
                      ],
                    },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "headingWeight",
                      type: "select",
                      label: "Başlık Kalınlığı",
                      defaultValue: DEFAULT_THEME_SETTINGS.headingWeight,
                      options: [
                        { label: "Semi-Bold (600)", value: "600" },
                        { label: "Bold (700)", value: "700" },
                        { label: "Extra-Bold (800)", value: "800" },
                      ],
                    },
                    {
                      name: "headingLetterSpacing",
                      type: "select",
                      label: "Başlık Harf Aralığı",
                      defaultValue: DEFAULT_THEME_SETTINGS.headingLetterSpacing,
                      options: [
                        { label: "Sıkı (Tight)", value: "tight" },
                        { label: "Normal", value: "normal" },
                        { label: "Geniş (Wide)", value: "wide" },
                      ],
                    },
                    {
                      name: "lineHeight",
                      type: "select",
                      label: "Satır Yüksekliği",
                      defaultValue: DEFAULT_THEME_SETTINGS.lineHeight,
                      options: [
                        { label: "Kompakt (1.35)", value: "compact" },
                        { label: "Standart (1.5)", value: "normal" },
                        { label: "Ferah (1.7)", value: "relaxed" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "Butonlar & Köşeler",
          description: "Buton şekli, köşe yuvarlaklığı ve buton metin stili.",
          fields: [
            {
              name: "buttons",
              type: "group",
              label: "Buton ve Kart Biçimi",
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "buttonRadius",
                      type: "select",
                      label: "Buton Köşe Yuvarlaklığı",
                      defaultValue: DEFAULT_THEME_SETTINGS.buttonRadius,
                      options: [
                        { label: "Köşeli (0px)", value: "none" },
                        { label: "Hafif (4px)", value: "sm" },
                        { label: "Orta (6px)", value: "md" },
                        { label: "Yumuşak (10px)", value: "lg" },
                        { label: "Tam Yuvarlak (Pill)", value: "full" },
                      ],
                    },
                    {
                      name: "borderRadius",
                      type: "select",
                      label: "Kart & Input Yuvarlaklığı",
                      defaultValue: DEFAULT_THEME_SETTINGS.borderRadius,
                      options: [
                        { label: "Köşeli (0px)", value: "none" },
                        { label: "Hafif (4px)", value: "sm" },
                        { label: "Orta (6px)", value: "md" },
                        { label: "Yumuşak (10px)", value: "lg" },
                        { label: "Tam Yuvarlak", value: "full" },
                      ],
                    },
                  ],
                },
                {
                  type: "row",
                  fields: [
                    {
                      name: "buttonTextTransform",
                      type: "select",
                      label: "Buton Yazı Stili",
                      defaultValue: DEFAULT_THEME_SETTINGS.buttonTextTransform,
                      options: [
                        { label: "Normal (Yazıldığı Gibi)", value: "none" },
                        { label: "BÜYÜK HARF", value: "uppercase" },
                      ],
                    },
                    {
                      name: "buttonFontWeight",
                      type: "select",
                      label: "Buton Yazı Kalınlığı",
                      defaultValue: DEFAULT_THEME_SETTINGS.buttonFontWeight,
                      options: [
                        { label: "Orta (500)", value: "500" },
                        { label: "Yarı Kalın (600)", value: "600" },
                        { label: "Kalın (700)", value: "700" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "Ödeme & Sepet",
          description: "Ödeme sayfasının sol form ve sağ sipariş özeti renkleri.",
          fields: [
            {
              name: "checkoutTheme",
              type: "group",
              label: "Ödeme Ekranı Renkleri",
              fields: [
                {
                  type: "row",
                  fields: [
                    colorField(
                      "checkoutLeftBgColor",
                      "Sol Form Alanı Arka Planı",
                      DEFAULT_THEME_SETTINGS.checkoutLeftBgColor,
                    ),
                    colorField(
                      "checkoutSummaryBgColor",
                      "Sağ Sipariş Özeti Arka Planı",
                      DEFAULT_THEME_SETTINGS.checkoutSummaryBgColor,
                    ),
                    colorField(
                      "checkoutBadgeBgColor",
                      "Ürün Adet Rozeti Rengi",
                      DEFAULT_THEME_SETTINGS.checkoutBadgeBgColor,
                    ),
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
