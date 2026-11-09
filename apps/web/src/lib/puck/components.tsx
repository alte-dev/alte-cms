import React from "react";
import Link from "next/link";
import { safeHref } from "../safe-href";

// 1. Hero
export interface HeroProps {
  title?: string;
  subtitle?: string;
  bgImage?: string;
  bgColor?: "white" | "gray" | "dark" | "rose";
  align?: "left" | "center" | "right";
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
}

export function HeroComponent({
  title = "Özel Koleksiyonu Keşfedin",
  subtitle = "Kalite ve zarafeti buluşturan yeni sezon tasarımları inceleyin.",
  bgImage,
  bgColor = "gray",
  align = "center",
  primaryButtonText = "Alışverişe Başla",
  primaryButtonHref = "/magaza",
  secondaryButtonText,
  secondaryButtonHref,
}: HeroProps) {
  const bgClasses = {
    white: "bg-white text-zinc-900",
    gray: "bg-zinc-50 text-zinc-900 border-y border-zinc-200",
    dark: "bg-zinc-900 text-white",
    rose: "bg-rose-50 text-rose-950 border-y border-rose-100",
  }[bgColor];

  const alignClasses = {
    left: "text-left items-start",
    center: "text-center items-center mx-auto",
    right: "text-right items-end ml-auto",
  }[align];

  return (
    <section
      className={`relative py-16 md:py-24 px-4 sm:px-6 lg:px-8 ${bgClasses} overflow-hidden`}
      style={
        bgImage
          ? {
              backgroundImage: `url(${bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {bgImage && <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />}
      <div className={`relative max-w-4xl flex flex-col ${alignClasses}`}>
        {title && (
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-200 max-w-2xl mb-8 leading-relaxed">
            {subtitle}
          </p>
        )}
        <div className="flex flex-wrap gap-4 justify-center">
          {primaryButtonText && (
            <Link
              href={safeHref(primaryButtonHref)}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              {primaryButtonText}
            </Link>
          )}
          {secondaryButtonText && (
            <Link
              href={safeHref(secondaryButtonHref)}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-sm"
            >
              {secondaryButtonText}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

// 2. RichText
export interface RichTextProps {
  content?: string;
  maxWidth?: "prose" | "prose-lg" | "full";
}

export function RichTextComponent({
  content = "Buraya zengin metin içeriği yazabilirsiniz.",
  maxWidth = "prose-lg",
}: RichTextProps) {
  const maxClass = {
    prose: "max-w-prose",
    "prose-lg": "max-w-3xl",
    full: "max-w-full",
  }[maxWidth];

  return (
    <div className={`mx-auto px-4 sm:px-6 py-8 ${maxClass}`}>
      <div className="text-zinc-700 leading-relaxed whitespace-pre-line text-base sm:text-lg">
        {content}
      </div>
    </div>
  );
}

// 3. ImageBlock
export interface ImageBlockProps {
  src?: string;
  alt?: string;
  caption?: string;
  align?: "left" | "center" | "right";
  linkHref?: string;
}

export function ImageBlockComponent({
  src = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200",
  alt = "Görsel",
  caption,
  align = "center",
  linkHref,
}: ImageBlockProps) {
  const alignClass = {
    left: "mr-auto",
    center: "mx-auto",
    right: "ml-auto",
  }[align];

  const content = (
    <figure className={`max-w-4xl px-4 py-6 ${alignClass}`}>
      <img
        src={src}
        alt={alt || "Görsel"}
        className="w-full rounded-xl object-cover shadow-sm border border-zinc-200"
        loading="lazy"
      />
      {caption && (
        <figcaption className="text-center text-sm text-zinc-500 mt-2">{caption}</figcaption>
      )}
    </figure>
  );

  if (linkHref) {
    return <Link href={safeHref(linkHref)}>{content}</Link>;
  }

  return content;
}

// 4. Columns
export interface ColumnsProps {
  columns?: "2" | "3" | "4";
  col1Title?: string;
  col1Content?: string;
  col2Title?: string;
  col2Content?: string;
  col3Title?: string;
  col3Content?: string;
  col4Title?: string;
  col4Content?: string;
}

export function ColumnsComponent({
  columns = "3",
  col1Title = "Hızlı Teslimat",
  col1Content = "Siparişleriniz aynı gün kargoya teslim edilir.",
  col2Title = "Güvenli Ödeme",
  col2Content = "PayTR 256-bit SSL güvencesiyle kolay alışveriş.",
  col3Title = "Müşteri Desteği",
  col3Content = "Her türlü soru ve talebinizde yanınızdayız.",
  col4Title = "Orijinal Ürün Garantisi",
  col4Content = "Tüm ürünlerimiz %100 orijinal ve garantilidir.",
}: ColumnsProps) {
  const cols = parseInt(columns, 10);
  const gridClass =
    {
      2: "grid-cols-1 md:grid-cols-2",
      3: "grid-cols-1 md:grid-cols-3",
      4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    }[cols] || "grid-cols-1 md:grid-cols-3";

  const items = [
    { title: col1Title, text: col1Content },
    { title: col2Title, text: col2Content },
    { title: col3Title, text: col3Content },
    { title: col4Title, text: col4Content },
  ].slice(0, cols);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className={`grid gap-8 ${gridClass}`}>
        {items.map((item, idx) => (
          <div key={idx} className="p-6 rounded-xl border border-zinc-200 bg-zinc-50">
            {item.title && (
              <h3 className="font-semibold text-lg text-zinc-900 mb-2">{item.title}</h3>
            )}
            {item.text && <p className="text-zinc-600 text-sm leading-relaxed">{item.text}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// 5. Spacer
export interface SpacerProps {
  height?: "small" | "medium" | "large" | "xlarge";
}

export function SpacerComponent({ height = "medium" }: SpacerProps) {
  const heightClass = {
    small: "h-6 sm:h-8",
    medium: "h-12 sm:h-16",
    large: "h-20 sm:h-24",
    xlarge: "h-32 sm:h-40",
  }[height];

  return <div className={heightClass} aria-hidden="true" />;
}

// 6. Divider
export interface DividerProps {
  style?: "solid" | "dashed" | "dotted";
}

export function DividerComponent({ style = "solid" }: DividerProps) {
  const styleClass = {
    solid: "border-solid",
    dashed: "border-dashed",
    dotted: "border-dotted",
  }[style];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <hr className={`border-t border-zinc-200 ${styleClass}`} />
    </div>
  );
}

// 7. Accordion
export interface AccordionProps {
  q1?: string;
  a1?: string;
  q2?: string;
  a2?: string;
  q3?: string;
  a3?: string;
}

export function AccordionComponent({
  q1 = "Siparişim ne zaman kargoya verilir?",
  a1 = "Hafta içi saat 16:00'a kadar verilen siparişler aynı gün kargoya teslim edilmektedir.",
  q2 = "Hangi ödeme yöntemlerini kabul ediyorsunuz?",
  a2 = "Kredi kartı (PayTR güvencesiyle tek çekim ve taksitli) ve kapıda ödeme seçeneklerini kullanabilirsiniz.",
  q3 = "İade ve değişim koşulları nelerdir?",
  a3 = "Teslim tarihinden itibaren 14 gün içinde faturası ile birlikte ücretsiz iade edebilirsiniz.",
}: AccordionProps) {
  const items = [
    { q: q1, a: a1 },
    { q: q2, a: a2 },
    { q: q3, a: a3 },
  ].filter((it) => it.q && it.a);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="space-y-4">
        {items.map((it, idx) => (
          <details
            key={idx}
            className="group rounded-xl border border-zinc-200 bg-white p-5 open:bg-zinc-50 transition-colors"
          >
            <summary className="flex cursor-pointer items-center justify-between font-medium text-zinc-900 list-none">
              <span>{it.q}</span>
              <span className="transition group-open:rotate-180">
                <svg
                  className="h-5 w-5 text-zinc-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </span>
            </summary>
            <p className="mt-4 text-zinc-600 text-sm leading-relaxed">{it.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

// 8. Banner
export interface BannerProps {
  text?: string;
  style?: "info" | "warning" | "success" | "accent";
  linkText?: string;
  linkHref?: string;
}

export function BannerComponent({
  text = "Yeni sezon ürünlerinde geçerli %15 indirim fırsatı!",
  style = "accent",
  linkText = "İncele",
  linkHref = "/magaza",
}: BannerProps) {
  const bgClasses = {
    info: "bg-blue-600 text-white",
    warning: "bg-amber-500 text-zinc-950",
    success: "bg-emerald-600 text-white",
    accent: "bg-zinc-900 text-white",
  }[style];

  return (
    <aside className={`py-3 px-4 text-center text-sm font-medium ${bgClasses}`}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 flex-wrap">
        <span>{text}</span>
        {linkText && (
          <Link
            href={safeHref(linkHref)}
            className="underline underline-offset-4 font-semibold hover:opacity-80 transition-opacity ml-1"
          >
            {linkText} &rarr;
          </Link>
        )}
      </div>
    </aside>
  );
}

// 9. ContactInfo
export interface ContactInfoProps {
  title?: string;
  email?: string;
  phone?: string;
  address?: string;
  workingHours?: string;
}

export function ContactInfoComponent({
  title = "İletişim Bilgileri",
  email = "info@example.com",
  phone = "0850 000 00 00",
  address = "Nişantaşı, İstanbul, Türkiye",
  workingHours = "Hafta içi: 09:00 - 18:00",
}: ContactInfoProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h3 className="text-xl font-bold text-zinc-900 mb-6">{title}</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <dt className="text-zinc-500 mb-1">E-posta</dt>
            <dd className="font-medium text-zinc-900">{email}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 mb-1">Telefon</dt>
            <dd className="font-medium text-zinc-900">{phone}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 mb-1">Adres</dt>
            <dd className="font-medium text-zinc-900">{address}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500 mb-1">Çalışma Saatleri</dt>
            <dd className="font-medium text-zinc-900">{workingHours}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

// 10. ProductGrid
export interface ProductGridProps {
  title?: string;
  limit?: number;
}

export function ProductGridComponent({ title = "Öne Çıkan Ürünler", limit = 4 }: ProductGridProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h2>
        <Link href="/magaza" className="text-sm font-semibold text-zinc-900 hover:underline">
          Tümünü Gör &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {Array.from({ length: Math.min(limit, 8) }).map((_, idx) => (
          <div
            key={idx}
            className="group relative rounded-xl border border-zinc-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="aspect-square bg-zinc-100 rounded-lg mb-3 flex items-center justify-center text-zinc-400">
              <span className="text-xs">Ürün Görseli</span>
            </div>
            <h4 className="text-sm font-medium text-zinc-900 truncate">Örnek Ürün {idx + 1}</h4>
            <p className="text-sm font-semibold text-zinc-900 mt-1">499,00 TL</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// 11. FeaturedProducts
export interface FeaturedProductsProps {
  title?: string;
  subtitle?: string;
}

export function FeaturedProductsComponent({
  title = "Haftanın Seçimleri",
  subtitle = "En çok tercih edilen özel parçalar",
}: FeaturedProductsProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center max-w-xl mx-auto mb-10">
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h2>
        {subtitle && <p className="text-zinc-600 mt-2">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[1, 2, 3].map((num) => (
          <div
            key={num}
            className="rounded-xl border border-zinc-200 p-4 bg-white hover:border-zinc-400 transition-colors"
          >
            <div className="aspect-[4/5] bg-zinc-100 rounded-lg mb-4 flex items-center justify-center text-zinc-400">
              <span className="text-xs">Öne Çıkan Ürün</span>
            </div>
            <h3 className="font-medium text-zinc-900">Sezon Özel Serisi {num}</h3>
            <p className="text-zinc-500 text-sm mt-1">1.250,00 TL</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// 12. CategoryList
export interface CategoryListProps {
  title?: string;
}

export function CategoryListComponent({ title = "Kategorilere Göz Atın" }: CategoryListProps) {
  const categories = [
    { name: "Elbiseler", href: "/kategori/elbiseler" },
    { name: "Takımlar", href: "/kategori/takimlar" },
    { name: "Aksesuarlar", href: "/kategori/aksesuarlar" },
    { name: "Yeni Gelenler", href: "/kategori/yeni-gelenler" },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-8">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((cat, idx) => (
          <Link
            key={idx}
            href={safeHref(cat.href)}
            className="group relative rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
          >
            <span className="font-semibold text-base block">{cat.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// 13. FreeShippingBar
export interface FreeShippingBarProps {
  threshold?: number;
  message?: string;
}

export function FreeShippingBarComponent({
  threshold = 1000,
  message = "1.000 TL ve üzeri tüm siparişlerde ÜCRETSİZ KARGO!",
}: FreeShippingBarProps) {
  return (
    <div className="bg-emerald-50 border-y border-emerald-200 py-2.5 px-4 text-center">
      <p className="text-emerald-900 text-sm font-medium flex items-center justify-center gap-2">
        <svg
          className="w-5 h-5 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span>{message}</span>
      </p>
    </div>
  );
}

// 14. LatestPosts
export interface LatestPostsProps {
  title?: string;
  limit?: number;
}

export function LatestPostsComponent({
  title = "Blogdan Son Yazılar",
  limit = 3,
}: LatestPostsProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h2>
        <Link href="/blog" className="text-sm font-semibold text-zinc-900 hover:underline">
          Tüm Yazılar &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {Array.from({ length: Math.min(limit, 3) }).map((_, idx) => (
          <article
            key={idx}
            className="group rounded-xl border border-zinc-200 p-5 hover:border-zinc-400 transition-colors"
          >
            <div className="aspect-[16/9] bg-zinc-100 rounded-lg mb-4 flex items-center justify-center text-zinc-400">
              <span className="text-xs">Blog Görseli</span>
            </div>
            <time className="text-xs text-zinc-500">8 Kasım 2026</time>
            <h3 className="font-semibold text-lg text-zinc-900 mt-1 mb-2 group-hover:text-blue-600 transition-colors">
              Stil Rehberi: Yeni Sezon Trendleri
            </h3>
            <p className="text-zinc-600 text-sm line-clamp-2">
              Gardırobunuzu yenilerken dikkat etmeniz gereken ipuçları ve stil önerileri...
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
