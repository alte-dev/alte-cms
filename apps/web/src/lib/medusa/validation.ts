import { z } from "zod";

export const ProductSortSchema = z
  .enum(["created_at", "price_asc", "price_desc"])
  .optional()
  .default("created_at");

export type ProductSortOption = z.infer<typeof ProductSortSchema>;

export const ProductQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(12),
  sort: ProductSortSchema,
  category: z.string().trim().max(100).optional(),
  collection: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
});

export type ProductQueryInput = z.infer<typeof ProductQuerySchema>;

export const HandleParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-z0-9-]+$/, "Geçersiz handle formatı");

export const AddToCartSchema = z.object({
  variantId: z.string().min(1, "Varyant ID zorunludur"),
  quantity: z.coerce.number().int().min(1, "Adet en az 1 olmalıdır").max(99),
});

export const UpdateCartItemSchema = z.object({
  lineItemId: z.string().min(1, "Sepet kalemi ID zorunludur"),
  quantity: z.coerce.number().int().min(0, "Adet 0 veya daha fazla olmalıdır").max(99),
});
