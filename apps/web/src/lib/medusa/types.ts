export interface StorePrice {
  id?: string;
  currency_code: string;
  amount: number;
  calculated_amount?: number;
  original_amount?: number;
}

export interface StoreProductVariantOption {
  id: string;
  value: string;
  option_id: string;
}

export interface StoreProductVariant {
  id: string;
  title: string;
  sku: string;
  manage_inventory?: boolean;
  allow_backorder?: boolean;
  inventory_quantity?: number;
  options?: StoreProductVariantOption[];
  prices?: StorePrice[];
  calculated_price?: {
    calculated_amount: number;
    original_amount: number;
    currency_code: string;
    is_calculated_price_tax_inclusive?: boolean;
  };
  metadata?: Record<string, any>;
}

export interface StoreProductOption {
  id: string;
  title: string;
  values: Array<{ id: string; value: string }>;
}

export interface StoreProductCategory {
  id: string;
  name: string;
  handle: string;
  description?: string;
  parent_category_id?: string | null;
  category_children?: StoreProductCategory[];
}

export interface StoreCollection {
  id: string;
  title: string;
  handle: string;
}

export interface StoreProduct {
  id: string;
  title: string;
  handle: string;
  subtitle?: string | null;
  description?: string;
  thumbnail?: string | null;
  images?: Array<{ id: string; url: string }>;
  status: string;
  categories?: StoreProductCategory[];
  collection?: StoreCollection;
  collection_id?: string | null;
  options?: StoreProductOption[];
  variants?: StoreProductVariant[];
  created_at: string;
  metadata?: Record<string, any>;
}

export interface StoreCartLineItem {
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_total: number;
  total: number;
  product_id?: string;
  product_title?: string;
  product_handle?: string;
  variant_id?: string;
  variant_title?: string;
  variant?: StoreProductVariant;
  metadata?: Record<string, any>;
  sku?: string;
}

export interface StoreShippingOptionRule {
  id: string;
  attribute: string;
  operator: string;
  value: string;
}

export interface StoreShippingOption {
  id: string;
  name: string;
  price_type: "flat" | "calculated";
  amount: number;
  rules?: StoreShippingOptionRule[];
}

export interface StoreAddress {
  id?: string;
  first_name: string;
  last_name: string;
  address_1: string;
  address_2?: string | null;
  city: string;
  country_code: string;
  province?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  company?: string | null;
  metadata?: Record<string, any> | null;
}

export interface StorePromotion {
  id: string;
  code: string;
  type?: string;
  is_automatic?: boolean;
  application_method?: {
    type: "percentage" | "fixed";
    value: number;
    currency_code?: string;
  };
}

export interface StoreCart {
  id: string;
  currency_code: string;
  region_id: string;
  email?: string | null;
  completed_at?: string | null;
  items: StoreCartLineItem[];
  item_subtotal?: number;
  item_total?: number;
  subtotal: number;
  discount_total?: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  shipping_address?: StoreAddress | null;
  billing_address?: StoreAddress | null;
  shipping_methods?: Array<{
    id: string;
    shipping_option_id: string;
    amount: number;
    name?: string;
    shipping_option?: StoreShippingOption;
  }>;
  promotions?: StorePromotion[];
  metadata?: Record<string, any> | null;
  shipping_options?: StoreShippingOption[];
}

export interface StoreOrder {
  id: string;
  display_id?: number | string;
  status: string;
  currency_code: string;
  email: string;
  created_at: string;
  items: StoreCartLineItem[];
  shipping_address?: StoreAddress | null;
  billing_address?: StoreAddress | null;
  subtotal: number;
  item_subtotal?: number;
  shipping_total: number;
  tax_total: number;
  discount_total?: number;
  total: number;
  metadata?: {
    invoice_type?: "individual" | "corporate";
    company_name?: string;
    tax_office?: string;
    tax_number?: string;
    distance_sales_contract_consent_at?: string;
    kvkk_consent_at?: string;
    [key: string]: any;
  } | null;
}

export interface StoreOrderResponse {
  order: StoreOrder;
}

export interface StoreRegion {
  id: string;
  name: string;
  currency_code: string;
  automatic_taxes: boolean;
}

export interface StoreRegionListResponse {
  regions: StoreRegion[];
}

export interface StoreCategoryListResponse {
  product_categories: StoreProductCategory[];
}

export interface StoreCollectionListResponse {
  collections: StoreCollection[];
}

export interface StoreProductListResponse {
  products: StoreProduct[];
  count: number;
  offset: number;
  limit: number;
}

export interface StoreProductResponse {
  product: StoreProduct;
}

export interface StoreCartResponse {
  cart: StoreCart;
}
