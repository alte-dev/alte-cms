import { model } from "@medusajs/framework/utils";

export const ContactMessage = model.define("contact_message", {
  id: model.id().primaryKey(),
  name: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  subject: model.text(),
  message: model.text(),
  kvkk_accepted: model.boolean().default(false),
  status: model.text().default("new"), // new | in_progress | replied | archived
  reply_message: model.text().nullable(),
  replied_at: model.dateTime().nullable(),
  replied_by: model.text().nullable(),
  internal_note: model.text().nullable(),
});
