import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContactMessageService } from "../../../modules/contact-message";
import { checkAdminOrShopManagerRole } from "../../../utils/admin-role-guard";

const ALLOWED_STATUSES = new Set(["new", "in_progress", "replied", "archived"]);

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!(await checkAdminOrShopManagerRole(req, res))) return;

  try {
    const service = req.scope.resolve<ContactMessageService>("contactMessageModuleService");
    const statusParam = typeof req.query?.status === "string" ? req.query.status : undefined;
    const filters = statusParam && ALLOWED_STATUSES.has(statusParam) ? { status: statusParam } : {};

    const messages = await service.listContactMessages(filters, {
      order: { created_at: "DESC" },
      take: 100,
    });

    return res.status(200).json({ messages });
  } catch (err: any) {
    return res.status(500).json({
      error: `İletişim mesajları yüklenemedi: ${err?.message || "Bilinmeyen hata"}`,
    });
  }
};
