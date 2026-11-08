import { z } from "zod";

/**
 * Turkish character ASCII slug normalizer.
 * Maps Turkish diacritics to ASCII equivalents and normalizes into URL-safe slugs.
 */
export function normalizeTurkishSlug(text: string): string {
  const turkishMap: Record<string, string> = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    I: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };

  const replaced = text.replace(/[çÇğĞıIİöÖşŞüÜ]/g, (char) => turkishMap[char] || char);

  return replaced
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip remaining combining diacritics
    .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric except spaces and dashes
    .trim()
    .replace(/[\s_-]+/g, "-") // collapse spaces and underscores into single dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}

/**
 * Production payment provider guard.
 * Fails closed if pp_system_default is enabled in production.
 */
export function assertProductionPaymentConfigured(
  providers: string[],
  nodeEnv: string = process.env.NODE_ENV || "development",
): boolean {
  if (nodeEnv === "production") {
    if (providers.includes("pp_system_default")) {
      throw new Error(
        "FAIL-CLOSED: 'pp_system_default' is strictly prohibited in production. A certified payment provider (e.g. PayTR, Kapıda Ödeme / pp_paytr, pp_cod) must be configured.",
      );
    }
    if (providers.length === 0) {
      throw new Error("FAIL-CLOSED: No payment providers configured for production environment.");
    }
  }
  return true;
}

export const TaxRateConfigSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  rate: z.number().min(0).max(100),
  is_default: z.boolean(),
  product_type_value: z.string().nullable(),
});

export const ShippingOptionConfigSchema = z.object({
  name: z.string().min(1),
  price_type: z.literal("flat"),
  amount: z.number().min(0),
  min_subtotal: z.number().min(0).nullable(),
});

export const CategoryItemSchema: z.ZodType<{
  name: string;
  slug: string;
  description?: string;
  children?: any[];
}> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().optional(),
    children: z.array(CategoryItemSchema).optional(),
  }),
);

export const StoreDefaultsSchema = z.object({
  store: z.object({
    name: z.string().min(1),
    default_currency_code: z.literal("try"),
  }),
  region: z.object({
    name: z.string().min(1),
    currency_code: z.literal("try"),
    countries: z.array(z.string().length(2)).min(1),
    automatic_taxes: z.boolean(),
    is_tax_inclusive: z.boolean(),
  }),
  tax_rates: z.array(TaxRateConfigSchema).min(1),
  sales_channel: z.object({
    name: z.string().min(1),
    description: z.string(),
  }),
  stock_location: z.object({
    name: z.string().min(1),
    address: z.object({
      address_1: z.string().min(1),
      city: z.string().min(1),
      country_code: z.literal("tr"),
      postal_code: z.string().min(1),
    }),
  }),
  fulfillment: z.object({
    provider_id: z.string().min(1),
    service_zone_name: z.string().min(1),
    shipping_options: z.array(ShippingOptionConfigSchema).min(1),
  }),
  categories: z.array(CategoryItemSchema).min(1),
  collections: z.array(
    z.object({
      name: z.string().min(1),
      slug: z.string().min(1),
    }),
  ),
  tags: z.array(
    z.object({
      value: z.string().min(1),
    }),
  ),
  publishable_api_key: z.object({
    title: z.string().min(1),
  }),
});

export type StoreDefaults = z.infer<typeof StoreDefaultsSchema>;

/**
 * Turkey store configuration constants for single-store WooCommerce-like setup.
 */
export const STORE_DEFAULTS: StoreDefaults = StoreDefaultsSchema.parse({
  store: {
    name: "Çisem Elif Boz",
    default_currency_code: "try",
  },
  region: {
    name: "Türkiye",
    currency_code: "try",
    countries: ["tr"],
    automatic_taxes: true,
    is_tax_inclusive: true,
  },
  tax_rates: [
    {
      code: "KDV20",
      name: "Standart KDV (%20)",
      rate: 20,
      is_default: true,
      product_type_value: null,
    },
    {
      code: "KDV10",
      name: "Gıda/Temel KDV (%10)",
      rate: 10,
      is_default: false,
      product_type_value: "food",
    },
    {
      code: "KDV1",
      name: "Özel İndirimli KDV (%1)",
      rate: 1,
      is_default: false,
      product_type_value: "special",
    },
  ],
  sales_channel: {
    name: "Web Mağaza",
    description: "Ana web mağazası satış kanalı",
  },
  stock_location: {
    name: "Ana Depo",
    address: {
      address_1: "Merkez Mah. İstiklal Cad. No: 1",
      city: "İstanbul",
      country_code: "tr",
      postal_code: "34000",
    },
  },
  fulfillment: {
    provider_id: "manual_manual",
    service_zone_name: "Türkiye",
    shipping_options: [
      {
        name: "Standart Kargo",
        price_type: "flat",
        amount: 89.9,
        min_subtotal: null,
      },
      {
        name: "Ücretsiz Kargo",
        price_type: "flat",
        amount: 0,
        min_subtotal: 1500,
      },
      {
        name: "Mağazadan Teslim",
        price_type: "flat",
        amount: 0,
        min_subtotal: null,
      },
    ],
  },
  categories: [
    {
      name: "Giyim",
      slug: normalizeTurkishSlug("Giyim"),
      description: "Giyim koleksiyonu ve giysi ürünleri",
      children: [
        {
          name: "Üst Giyim",
          slug: normalizeTurkishSlug("Üst Giyim"),
          description: "T-shirt, gömlek, kazak ve üst giyim ürünleri",
        },
        {
          name: "Alt Giyim",
          slug: normalizeTurkishSlug("Alt Giyim"),
          description: "Pantolon, etek, şort ve alt giyim ürünleri",
        },
      ],
    },
    {
      name: "Aksesuar",
      slug: normalizeTurkishSlug("Aksesuar"),
      description: "Çanta, takı ve moda aksesuarları",
    },
    {
      name: "Ev & Yaşam",
      slug: normalizeTurkishSlug("Ev & Yaşam"),
      description: "Ev dekorasyonu, tekstil ve yaşam ürünleri",
    },
  ],
  collections: [
    {
      name: "Yeni Gelenler",
      slug: normalizeTurkishSlug("Yeni Gelenler"),
    },
    {
      name: "İndirimdekiler",
      slug: normalizeTurkishSlug("İndirimdekiler"),
    },
  ],
  tags: [{ value: "organik" }, { value: "yeni-sezon" }, { value: "one-cikan" }],
  publishable_api_key: {
    title: "Web Mağaza API Key",
  },
});
