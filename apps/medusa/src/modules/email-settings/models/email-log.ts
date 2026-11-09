import { model } from "@medusajs/framework/utils";

/**
 * Audit log for transactional emails.
 * Zero Customer PII: Recipient email is strictly masked (c***@example.test),
 * and payload_json is never persisted. Re-dispatch reads from order table by order_id.
 */
export const EmailLog = model.define("email_log", {
  id: model.id().primaryKey(),
  order_id: model.text(),
  template: model.text(),
  idempotency_key: model.text().unique(),
  recipient_masked: model.text(),
  subject: model.text(),
  status: model.text(),
  error_code: model.text().nullable(),
  attempts: model.number().default(1),
});

export default EmailLog;
