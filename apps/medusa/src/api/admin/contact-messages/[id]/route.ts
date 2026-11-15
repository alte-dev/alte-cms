import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { ContactMessageService } from "../../../../modules/contact-message";
import { createTransporter } from "../../../../services/email-service";
import {
  checkAdminOrShopManagerRole,
  checkAdminSettingsRole,
} from "../../../../utils/admin-role-guard";
import { dispatchContactReplyEmail } from "../../../../utils/contact-email-templates";

const patchContactMessageSchema = z.object({
  status: z.enum(["new", "in_progress", "replied", "archived"]).optional(),
  internal_note: z.string().max(2000).optional(),
  reply_message: z.string().trim().min(1).max(5000).optional(),
  store_name: z.string().max(120).optional(),
});

export const PATCH = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!(await checkAdminOrShopManagerRole(req, res))) return;

  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ error: "Mesaj ID zorunludur." });
  }

  const parsed = patchContactMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Geçersiz güncelleme verisi." });
  }

  try {
    const service = req.scope.resolve<ContactMessageService>("contactMessageModuleService");
    const existing = await service.retrieveContactMessage(id).catch(() => null);
    if (!existing) {
      return res.status(404).json({ error: "İletişim mesajı bulunamadı." });
    }

    const updateData: Record<string, any> = {};
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
    }
    if (parsed.data.internal_note !== undefined) {
      updateData.internal_note = parsed.data.internal_note;
    }

    if (parsed.data.reply_message) {
      const pgConnection =
        req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
        req.scope.resolve("__pg_connection__");
      const { transporter, settings } = await createTransporter(pgConnection);
      if (!transporter || !settings) {
        return res.status(503).json({
          error: "SMTP e-posta servisi aktif değil; yanıt e-postası gönderilemedi.",
        });
      }

      const storeName = parsed.data.store_name || settings.from_name || "Mağaza";
      await dispatchContactReplyEmail(transporter, settings, {
        storeName,
        customerName: existing.name,
        customerEmail: existing.email,
        originalSubject: existing.subject,
        replyMessage: parsed.data.reply_message,
      });

      const actor =
        (req as any).user?.email || (req as any).auth_context?.actor_id || "shop-manager";
      updateData.reply_message = parsed.data.reply_message;
      updateData.status = "replied";
      updateData.replied_at = new Date();
      updateData.replied_by = String(actor);
    }

    const updated = await service.updateContactMessages({
      id,
      ...updateData,
    });

    return res.status(200).json({ message: updated });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "İletişim mesajı güncellenemedi.",
    });
  }
};

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!(await checkAdminSettingsRole(req, res))) return;

  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ error: "Mesaj ID zorunludur." });
  }

  try {
    const service = req.scope.resolve<ContactMessageService>("contactMessageModuleService");
    await service.deleteContactMessages(id);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "İletişim mesajı silinemedi." });
  }
};
