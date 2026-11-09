import type { Config } from "@puckeditor/core";
import {
  HeroComponent,
  RichTextComponent,
  ImageBlockComponent,
  ColumnsComponent,
  SpacerComponent,
  DividerComponent,
  AccordionComponent,
  BannerComponent,
  ContactInfoComponent,
  ProductGridComponent,
  FeaturedProductsComponent,
  CategoryListComponent,
  FreeShippingBarComponent,
  LatestPostsComponent,
  type HeroProps,
  type RichTextProps,
  type ImageBlockProps,
  type ColumnsProps,
  type SpacerProps,
  type DividerProps,
  type AccordionProps,
  type BannerProps,
  type ContactInfoProps,
  type ProductGridProps,
  type FeaturedProductsProps,
  type CategoryListProps,
  type FreeShippingBarProps,
  type LatestPostsProps,
} from "./components";

export type ComponentConfigProps = {
  Hero: HeroProps;
  RichText: RichTextProps;
  ImageBlock: ImageBlockProps;
  Columns: ColumnsProps;
  Spacer: SpacerProps;
  Divider: DividerProps;
  Accordion: AccordionProps;
  Banner: BannerProps;
  ContactInfo: ContactInfoProps;
  ProductGrid: ProductGridProps;
  FeaturedProducts: FeaturedProductsProps;
  CategoryList: CategoryListProps;
  FreeShippingBar: FreeShippingBarProps;
  LatestPosts: LatestPostsProps;
};

export const puckConfig: Config<ComponentConfigProps> = {
  components: {
    Hero: {
      label: "Hero (Ana Başlık & Banner)",
      fields: {
        title: { type: "text", label: "Başlık" },
        subtitle: { type: "textarea", label: "Alt Başlık" },
        bgImage: { type: "text", label: "Arka Plan Görseli URL" },
        bgColor: {
          type: "select",
          label: "Arka Plan Rengi",
          options: [
            { label: "Gri (Açık)", value: "gray" },
            { label: "Beyaz", value: "white" },
            { label: "Koyu (Siyah)", value: "dark" },
            { label: "Gül Kurusu", value: "rose" },
          ],
        },
        align: {
          type: "radio",
          label: "Hizalama",
          options: [
            { label: "Sol", value: "left" },
            { label: "Orta", value: "center" },
            { label: "Sağ", value: "right" },
          ],
        },
        primaryButtonText: { type: "text", label: "Ana Buton Metni" },
        primaryButtonHref: { type: "text", label: "Ana Buton Bağlantısı (/...)" },
        secondaryButtonText: { type: "text", label: "İkinci Buton Metni" },
        secondaryButtonHref: { type: "text", label: "İkinci Buton Bağlantısı (/...)" },
      },
      render: (props) => <HeroComponent {...props} />,
    },

    RichText: {
      label: "Zengin Metin (RichText)",
      fields: {
        content: { type: "textarea", label: "Metin İçeriği" },
        maxWidth: {
          type: "select",
          label: "Genişlik",
          options: [
            { label: "Standart", value: "prose" },
            { label: "Geniş", value: "prose-lg" },
            { label: "Tam Boyut", value: "full" },
          ],
        },
      },
      render: (props) => <RichTextComponent {...props} />,
    },

    ImageBlock: {
      label: "Görsel Bloğu (Image)",
      fields: {
        src: { type: "text", label: "Görsel URL" },
        alt: { type: "text", label: "Alt Metin (SEO)" },
        caption: { type: "text", label: "Görsel Açıklaması (Altyazı)" },
        align: {
          type: "radio",
          label: "Hizalama",
          options: [
            { label: "Sol", value: "left" },
            { label: "Orta", value: "center" },
            { label: "Sağ", value: "right" },
          ],
        },
        linkHref: { type: "text", label: "Görsel Bağlantısı (Opsiyonel)" },
      },
      render: (props) => <ImageBlockComponent {...props} />,
    },

    Columns: {
      label: "Kolonlar (Çoklu Sütun)",
      fields: {
        columns: {
          type: "select",
          label: "Kolon Sayısı",
          options: [
            { label: "2 Kolon", value: "2" },
            { label: "3 Kolon", value: "3" },
            { label: "4 Kolon", value: "4" },
          ],
        },
        col1Title: { type: "text", label: "1. Kolon Başlık" },
        col1Content: { type: "textarea", label: "1. Kolon İçerik" },
        col2Title: { type: "text", label: "2. Kolon Başlık" },
        col2Content: { type: "textarea", label: "2. Kolon İçerik" },
        col3Title: { type: "text", label: "3. Kolon Başlık" },
        col3Content: { type: "textarea", label: "3. Kolon İçerik" },
        col4Title: { type: "text", label: "4. Kolon Başlık" },
        col4Content: { type: "textarea", label: "4. Kolon İçerik" },
      },
      render: (props) => <ColumnsComponent {...props} />,
    },

    Spacer: {
      label: "Boşluk (Spacer)",
      fields: {
        height: {
          type: "select",
          label: "Yükseklik",
          options: [
            { label: "Küçük (32px)", value: "small" },
            { label: "Orta (64px)", value: "medium" },
            { label: "Büyük (96px)", value: "large" },
            { label: "Çok Büyük (144px)", value: "xlarge" },
          ],
        },
      },
      render: (props) => <SpacerComponent {...props} />,
    },

    Divider: {
      label: "Ayırıcı Çizgi (Divider)",
      fields: {
        style: {
          type: "select",
          label: "Çizgi Türü",
          options: [
            { label: "Düz Çizgi", value: "solid" },
            { label: "Kesikli", value: "dashed" },
            { label: "Noktalı", value: "dotted" },
          ],
        },
      },
      render: (props) => <DividerComponent {...props} />,
    },

    Accordion: {
      label: "Açılır Panel / SSS (Accordion)",
      fields: {
        q1: { type: "text", label: "1. Soru" },
        a1: { type: "textarea", label: "1. Cevap" },
        q2: { type: "text", label: "2. Soru" },
        a2: { type: "textarea", label: "2. Cevap" },
        q3: { type: "text", label: "3. Soru" },
        a3: { type: "textarea", label: "3. Cevap" },
      },
      render: (props) => <AccordionComponent {...props} />,
    },

    Banner: {
      label: "Duyuru Bandı (Banner)",
      fields: {
        text: { type: "text", label: "Duyuru Metni" },
        style: {
          type: "select",
          label: "Renk Teması",
          options: [
            { label: "Koyu (Siyah)", value: "accent" },
            { label: "Yeşil (Başarı)", value: "success" },
            { label: "Mavi (Bilgi)", value: "info" },
            { label: "Turuncu (Uyarı)", value: "warning" },
          ],
        },
        linkText: { type: "text", label: "Bağlantı Metni" },
        linkHref: { type: "text", label: "Bağlantı URL" },
      },
      render: (props) => <BannerComponent {...props} />,
    },

    ContactInfo: {
      label: "İletişim Bilgileri (Contact Info)",
      fields: {
        title: { type: "text", label: "Başlık" },
        email: { type: "text", label: "E-posta" },
        phone: { type: "text", label: "Telefon" },
        address: { type: "textarea", label: "Adres" },
        workingHours: { type: "text", label: "Çalışma Saatleri" },
      },
      render: (props) => <ContactInfoComponent {...props} />,
    },

    ProductGrid: {
      label: "Ürün Izgarası (Product Grid)",
      fields: {
        title: { type: "text", label: "Bölüm Başlığı" },
        limit: { type: "number", label: "Ürün Sayısı (Max 8)" },
      },
      render: (props) => <ProductGridComponent {...props} />,
    },

    FeaturedProducts: {
      label: "Öne Çıkan Ürünler (Featured)",
      fields: {
        title: { type: "text", label: "Başlık" },
        subtitle: { type: "text", label: "Alt Açıklama" },
      },
      render: (props) => <FeaturedProductsComponent {...props} />,
    },

    CategoryList: {
      label: "Kategori Listesi (Categories)",
      fields: {
        title: { type: "text", label: "Bölüm Başlığı" },
      },
      render: (props) => <CategoryListComponent {...props} />,
    },

    FreeShippingBar: {
      label: "Ücretsiz Kargo Sayacı",
      fields: {
        threshold: { type: "number", label: "Kargo Ücretsiz Limiti (TL)" },
        message: { type: "text", label: "Mesaj Metni" },
      },
      render: (props) => <FreeShippingBarComponent {...props} />,
    },

    LatestPosts: {
      label: "Son Blog Yazıları",
      fields: {
        title: { type: "text", label: "Bölüm Başlığı" },
        limit: { type: "number", label: "Yazı Adedi (Max 3)" },
      },
      render: (props) => <LatestPostsComponent {...props} />,
    },
  },
};
