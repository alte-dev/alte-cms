import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import {
  checkCartAvailability,
  formatCartAvailabilityError,
} from "../../../../../utils/cart-availability";

const cartIdParamSchema = z
  .string()
  .trim()
  .regex(/^cart_[A-Za-z0-9_-]{4,64}$/, "Geçersiz sepet kimliği.");

function parseCartId(req: MedusaRequest): string | null {
  const parsed = cartIdParamSchema.safeParse(req.params?.id);
  return parsed.success ? parsed.data : null;
}

async function runAvailabilityCheck(req: MedusaRequest, cartId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  return checkCartAvailability({ query }, cartId);
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartId = parseCartId(req);
  if (!cartId) {
    return res.status(400).json({
      valid: false,
      code: "INVALID_CART_ID",
      issues: [],
      message: "Geçersiz sepet kimliği.",
    });
  }

  try {
    const result = await runAvailabilityCheck(req, cartId);
    if (!result.cartFound) {
      return res.status(404).json({ valid: false, issues: [], message: "Sepet bulunamadı." });
    }

    return res.status(200).json({
      valid: result.valid,
      issues: result.issues,
      ...(result.valid ? {} : { message: formatCartAvailabilityError(result.issues) }),
    });
  } catch (err: any) {
    console.error("[Store Cart ValidateAvailability GET] Error:", err?.message || err);
    return res.status(500).json({
      valid: false,
      issues: [],
      message: "Sepet ürün durumu doğrulanamadı.",
    });
  }
};

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartId = parseCartId(req);
  if (!cartId) {
    return res.status(400).json({
      valid: false,
      code: "INVALID_CART_ID",
      issues: [],
      message: "Geçersiz sepet kimliği.",
    });
  }

  try {
    const result = await runAvailabilityCheck(req, cartId);
    if (!result.cartFound) {
      return res.status(404).json({
        valid: false,
        code: "CART_NOT_FOUND",
        issues: [],
        message: "Sepet bulunamadı.",
      });
    }

    if (!result.valid) {
      return res.status(409).json({
        valid: false,
        code: "CART_ITEM_UNAVAILABLE",
        issues: result.issues,
        message: formatCartAvailabilityError(result.issues),
      });
    }

    return res.status(200).json({
      valid: true,
      issues: [],
    });
  } catch (err: any) {
    console.error("[Store Cart ValidateAvailability POST] Error:", err?.message || err);
    return res.status(500).json({
      valid: false,
      code: "AVAILABILITY_CHECK_FAILED",
      issues: [],
      message: "Sepet ürün durumu doğrulanamadı.",
    });
  }
};
