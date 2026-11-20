import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";
import { checkAdminOrShopManagerRole } from "../../../../../utils/admin-role-guard";
import { resolveAdminActorId, updateOrderAtomically } from "../../../../../utils/order-metadata-tx";

const noteSchema = z.object({
  note: z.string().min(1, "Not boş olamaz.").max(500, "Not en fazla 500 karakter olabilir."),
});

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (!(await checkAdminOrShopManagerRole(req, res))) return;
  const { id } = req.params;
  const parseResult = noteSchema.safeParse(req.body);

  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    return res.status(400).json({ error: errorMsg });
  }

  const { note } = parseResult.data;
  const adminUser = resolveAdminActorId(req);

  try {
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    const newNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      author: adminUser,
      content: note.trim(),
      created_at: new Date().toISOString(),
    };

    const txResult = await updateOrderAtomically(pgConnection, id, (lockedOrder) => {
      const currentMeta = lockedOrder.metadata || {};
      const existingNotes: unknown[] = Array.isArray(currentMeta.admin_notes)
        ? currentMeta.admin_notes
        : [];
      const updatedNotes = [newNote, ...existingNotes].slice(0, 50); // keep last 50 notes

      return {
        metadataPatch: { admin_notes: updatedNotes },
        result: newNote,
      };
    });

    if (txResult.ok === false) {
      return res.status(txResult.statusCode).json(txResult.body);
    }

    return res.status(200).json({
      success: true,
      message: "Yönetici notu kaydedildi.",
      note: txResult.result,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Not eklenirken hata: ${err.message}`,
    });
  }
};
