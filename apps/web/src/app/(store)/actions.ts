"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addItemToCart,
  applyPromotionCode,
  getOrCreateCart,
  removeCartItem,
  removePromotionCode,
  updateCartItem,
} from "../../lib/medusa/cart";
import { getProducts, getCategories } from "../../lib/medusa/products";
import { StoreProduct } from "../../lib/medusa/types";
import { mapMedusaError } from "../../lib/medusa/format";
import {
  AddToCartSchema,
  ApplyCouponSchema,
  UpdateCartItemSchema,
} from "../../lib/medusa/validation";

export interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server Action: Add a product variant to the current cart.
 */
export async function addToCartAction(input: {
  variantId: string;
  quantity?: number;
}): Promise<ActionResult> {
  const parsed = AddToCartSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Geçersiz ürün bilgisi.",
    };
  }

  try {
    const cart = await getOrCreateCart();
    const updatedCart = await addItemToCart(cart.id, parsed.data.variantId, parsed.data.quantity);

    revalidatePath("/sepet");
    revalidatePath("/(store)", "layout");

    return {
      success: true,
      data: updatedCart,
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapMedusaError(err),
    };
  }
}

/**
 * Server Action: Update item quantity in the cart.
 */
export async function updateCartItemAction(input: {
  lineItemId: string;
  quantity: number;
}): Promise<ActionResult> {
  const parsed = UpdateCartItemSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Geçersiz adet.",
    };
  }

  try {
    const cart = await getOrCreateCart();
    const updatedCart = await updateCartItem(cart.id, parsed.data.lineItemId, parsed.data.quantity);

    revalidatePath("/sepet");
    revalidatePath("/(store)", "layout");

    return {
      success: true,
      data: updatedCart,
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapMedusaError(err),
    };
  }
}

/**
 * Server Action: Remove item from cart.
 */
export async function removeCartItemAction(lineItemId: string): Promise<ActionResult> {
  if (!lineItemId) {
    return { success: false, error: "Kalem ID eksik." };
  }

  try {
    const cart = await getOrCreateCart();
    const updatedCart = await removeCartItem(cart.id, lineItemId);

    revalidatePath("/sepet");
    revalidatePath("/(store)", "layout");

    return {
      success: true,
      data: updatedCart,
    };
  } catch (err: any) {
    return {
      success: false,
      error: mapMedusaError(err),
    };
  }
}

/**
 * Server Action: Apply coupon code to current cart.
 */
export async function applyCouponAction(code: string): Promise<ActionResult> {
  const parsed = ApplyCouponSchema.safeParse({ code });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Lütfen geçerli bir kupon kodu giriniz.",
    };
  }

  try {
    const cart = await getOrCreateCart();
    const updatedCart = await applyPromotionCode(cart.id, parsed.data.code);

    revalidatePath("/sepet");
    revalidatePath("/odeme");
    revalidatePath("/(store)", "layout");

    return {
      success: true,
      data: updatedCart,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Geçersiz veya süresi dolmuş kupon kodu.",
    };
  }
}

/**
 * Server Action: Remove coupon code from current cart.
 */
export async function removeCouponAction(code: string): Promise<ActionResult> {
  try {
    const cart = await getOrCreateCart();
    const updatedCart = await removePromotionCode(cart.id, code);

    revalidatePath("/sepet");
    revalidatePath("/odeme");
    revalidatePath("/(store)", "layout");

    return {
      success: true,
      data: updatedCart,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Kupon kaldırılamadı.",
    };
  }
}

const FetchMoreProductsSchema = z.object({
  page: z
    .number()
    .int("Sayfa tam sayı olmalıdır.")
    .min(1, "Sayfa numarası en az 1 olmalıdır.")
    .max(100, "Geçersiz sayfa numarası: Maksimum 100. sayfa yüklenebilir."),
  limit: z.number().int().min(1).max(24).optional().default(12),
  category: z.string().max(100).optional(),
  sort: z.enum(["created_at", "price_asc", "price_desc"]).optional(),
});

/**
 * Server Action: Fetch additional products for infinite scroll with DoS & offset exhaustion guards.
 */
export async function fetchMoreProductsAction(params: {
  page: number;
  limit?: number;
  category?: string;
  sort?: "created_at" | "price_asc" | "price_desc";
}): Promise<{
  success: boolean;
  products: StoreProduct[];
  hasMore: boolean;
  totalPages: number;
  currentPage: number;
  error?: string;
}> {
  try {
    const parseResult = FetchMoreProductsSchema.safeParse(params);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues?.[0];
      return {
        success: false,
        products: [],
        hasMore: false,
        totalPages: 1,
        currentPage: typeof params?.page === "number" ? params.page : 1,
        error: firstIssue?.message || "Geçersiz sayfalama parametresi.",
      };
    }

    const { page, limit, category, sort } = parseResult.data;

    let categoryId: string | undefined = undefined;
    if (category) {
      const categories = await getCategories();
      const matched = categories.find(
        (c) => c.handle === category || c.id === category,
      );
      if (matched) {
        categoryId = matched.id;
      }
    }

    const result = await getProducts({
      page,
      limit,
      category_id: categoryId,
      sort,
    });

    return {
      success: true,
      products: result.products,
      hasMore: result.currentPage < result.totalPages,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    };
  } catch (err: any) {
    return {
      success: false,
      products: [],
      hasMore: false,
      totalPages: 1,
      currentPage: typeof params?.page === "number" ? params.page : 1,
      error: err?.message || "Ürünler yüklenirken bir hata oluştu.",
    };
  }
}
