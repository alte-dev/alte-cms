/**
 * Shared Roles across Payload CMS and Monorepo
 * 6 roles, default role is 'customer'.
 */
export const USER_ROLES = [
  "super-admin",
  "admin",
  "shop-manager",
  "editor",
  "author",
  "customer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Currency configuration for Turkey
 */
export const STORE_CURRENCY = {
  code: "TRY",
  symbol: "₺",
  vatRate: 0.2, // 20% standard VAT rate in Turkey
} as const;

/**
 * Common pagination result interface
 */
export interface PaginatedResult<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

/**
 * Medusa product link reference in Payload
 */
export interface MedusaProductRef {
  medusaProductId: string;
  customTitle?: string;
  puckPageData?: Record<string, unknown>;
}
