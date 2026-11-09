import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { z } from "zod";

const noteSchema = z.object({
  note: z.string().min(1, "Not boş olamaz.").max(500, "Not en fazla 500 karakter olabilir."),
});

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params;
  const parseResult = noteSchema.safeParse(req.body);

  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(", ");
    return res.status(400).json({ error: errorMsg });
  }

  const { note } = parseResult.data;
  const adminUser = (req as any).user?.email || (req as any).user?.id || "admin";

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const pgConnection =
      req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      req.scope.resolve("__pg_connection__");

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id },
    });

    const order = orders?.[0];
    if (!order) {
      return res.status(404).json({ error: "Sipariş bulunamadı." });
    }

    const currentMeta = order.metadata || {};
    const existingNotes: any[] = Array.isArray(currentMeta.admin_notes)
      ? currentMeta.admin_notes
      : [];

    const newNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      author: adminUser,
      content: note.trim(),
      created_at: new Date().toISOString(),
    };

    const updatedNotes = [newNote, ...existingNotes].slice(0, 50); // keep last 50 notes

    await pgConnection("order")
      .where({ id })
      .update({
        metadata: JSON.stringify({
          ...currentMeta,
          admin_notes: updatedNotes,
        }),
        updated_at: new Date(),
      });

    return res.status(200).json({
      success: true,
      message: "Yönetici notu kaydedildi.",
      note: newNote,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Not eklenirken hata: ${err.message}`,
    });
  }
};
