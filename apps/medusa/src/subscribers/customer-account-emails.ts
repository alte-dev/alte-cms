import crypto from "crypto";
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework/subscribers";
import { AuthWorkflowEvents, ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  normalizeEmail,
  PASSWORD_RESET_TTL_MS,
  hashToken,
} from "../modules/customer-account/helpers";
import { sendAccountEmail } from "../services/email-service";

function getWebBaseUrl(): string {
  return (process.env.WEB_PUBLIC_URL || "http://localhost:3100").replace(/\/+$/, "");
}

function resolvePg(container: any): any {
  try {
    return (
      container.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      container.resolve("__pg_connection__")
    );
  } catch {
    return null;
  }
}

export default async function customerAccountEmailSubscriber({
  event,
  container,
}: SubscriberArgs<Record<string, any>>) {
  const pgConnection = resolvePg(container);
  if (!pgConnection) return;

  const name = event.name;
  const data = event.data || {};
  const webBase = getWebBaseUrl();

  if (name === "customer_account.verification_requested") {
    const email = typeof data.email === "string" ? data.email : "";
    const token = typeof data.token === "string" ? data.token : "";
    const customerId = typeof data.customer_id === "string" ? data.customer_id : "anon";
    if (!email || !token) return;

    await sendAccountEmail(pgConnection, {
      template: "account.verify_email",
      recipientEmail: email,
      referenceId: customerId,
      actionUrl: `${webBase}/hesap/dogrula?token=${encodeURIComponent(token)}`,
    });
    return;
  }

  if (name === "customer_account.duplicate_register_attempt") {
    const email = typeof data.email === "string" ? data.email : "";
    const customerId = typeof data.customer_id === "string" ? data.customer_id : "anon";
    if (!email) return;

    await sendAccountEmail(pgConnection, {
      template: "account.duplicate_register",
      recipientEmail: email,
      referenceId: customerId,
    });
    return;
  }

  if (name === AuthWorkflowEvents.PASSWORD_RESET) {
    if (data.actor_type !== "customer") return;
    const email = typeof data.entity_id === "string" ? normalizeEmail(data.entity_id) : "";
    const token = typeof data.token === "string" ? data.token : "";
    if (!email || !token) return;

    const customer = await pgConnection("customer")
      .whereRaw("LOWER(email) = ?", [email])
      .andWhere("has_account", true)
      .whereNull("deleted_at")
      .select("id")
      .first();

    if (!customer?.id) return;

    const now = new Date();
    // Store SHA-256 hash so reset token is single-use and revocable
    await pgConnection("customer_password_reset")
      .insert({
        id: `cpr_${crypto.randomUUID().replace(/-/g, "")}`,
        customer_id: customer.id,
        token_hash: hashToken(token),
        expires_at: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
        used_at: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict("token_hash")
      .ignore();

    await sendAccountEmail(pgConnection, {
      template: "account.password_reset",
      recipientEmail: email,
      referenceId: customer.id,
      actionUrl: `${webBase}/hesap/sifre-sifirla?token=${encodeURIComponent(token)}`,
    });
  }
}

export const config: SubscriberConfig = {
  event: [
    "customer_account.verification_requested",
    "customer_account.duplicate_register_attempt",
    AuthWorkflowEvents.PASSWORD_RESET,
  ],
};
