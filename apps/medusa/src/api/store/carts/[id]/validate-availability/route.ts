import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  checkCartAvailability,
  formatCartAvailabilityError,
} from "../../../../../utils/cart-availability";

async function runAvailabilityCheck(req: MedusaRequest) {
  const cartId = req.params.id;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  return checkCartAvailability({ query }, cartId);
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const result = await runAvailabilityCheck(req);
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
  try {
    const result = await runAvailabilityCheck(req);
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
