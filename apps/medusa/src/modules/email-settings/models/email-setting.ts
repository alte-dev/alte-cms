import { model } from "@medusajs/framework/utils";

export const EmailSetting = model.define("email_setting", {
  id: model.id().primaryKey(),
  enabled: model.boolean().default(false),
  host: model.text().nullable(),
  port: model.number().default(587),
  secure: model.boolean().default(false),
  username: model.text().nullable(),
  password: model.text().nullable(), // Encrypted with AES-256-GCM
  from_name: model.text().default("Mağaza"),
  from_email: model.text().default("siparis@example.test"),
  reply_to: model.text().nullable(),
  admin_notify_email: model.text().nullable(),
});

export default EmailSetting;
