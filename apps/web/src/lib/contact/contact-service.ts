import { z } from "zod";
import { medusaFetch } from "../medusa/client";

export const contactSubmissionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ad Soyad en az 2 karakter olmalıdır.")
    .max(100, "Ad Soyad en fazla 100 karakter olabilir."),
  email: z
    .string()
    .trim()
    .email("Geçerli bir e-posta adresi giriniz.")
    .max(180, "E-posta adresi çok uzun."),
  phone: z
    .string()
    .trim()
    .max(30, "Telefon numarası en fazla 30 karakter olabilir.")
    .optional()
    .or(z.literal("")),
  subject: z
    .string()
    .trim()
    .min(2, "Konu en az 2 karakter olmalıdır.")
    .max(150, "Konu en fazla 150 karakter olabilir."),
  message: z
    .string()
    .trim()
    .min(10, "Mesajınız en az 10 karakter olmalıdır.")
    .max(5000, "Mesajınız en fazla 5000 karakter olabilir."),
  kvkkAccepted: z.literal(true, {
    message: "KVKK aydınlatma metnini onaylamanız gerekir.",
  }),
  website: z.string().max(200).optional(), // Honeypot field
});

export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const CONTACT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_MAX_REQUESTS = 5;
const MAX_CONTACT_RATE_LIMIT_ENTRIES = 10_000;
const contactRateLimitStore = new Map<string, RateLimitEntry>();

export function checkContactRateLimit(
  key: string,
  now = Date.now(),
  maxRequests = CONTACT_MAX_REQUESTS,
  windowMs = CONTACT_WINDOW_MS,
): { allowed: boolean; retryAfterSec?: number } {
  if (contactRateLimitStore.size >= MAX_CONTACT_RATE_LIMIT_ENTRIES && !contactRateLimitStore.has(key)) {
    for (const [k, entry] of contactRateLimitStore) {
      if (now >= entry.resetAt) {
        contactRateLimitStore.delete(k);
      }
    }
    if (contactRateLimitStore.size >= MAX_CONTACT_RATE_LIMIT_ENTRIES) {
      const oldestKey = contactRateLimitStore.keys().next().value;
      if (oldestKey !== undefined) {
        contactRateLimitStore.delete(oldestKey);
      }
    }
  }

  const existing = contactRateLimitStore.get(key);
  if (!existing || now >= existing.resetAt) {
    contactRateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true };
}

export function resetContactRateLimitForTest(): void {
  contactRateLimitStore.clear();
}

export interface ContactSubmissionEmailPayload {
  storeName: string;
  storeUrl?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  subject: string;
  message: string;
  kvkkAccepted?: boolean;
  recipientEmail?: string;
  autoReplyEnabled: boolean;
  autoReplySubject: string;
  autoReplyIntro: string;
}

export interface ContactReplyEmailPayload {
  storeName: string;
  customerName: string;
  customerEmail: string;
  originalSubject: string;
  replyMessage: string;
}

function getInternalSecretHeader(): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET || "";
  return secret ? { "x-alte-internal": secret } : {};
}

export async function submitContactMessageToMedusa(
  payload: ContactSubmissionEmailPayload,
): Promise<{ ok: boolean; id?: string; emailSent?: boolean }> {
  return medusaFetch("/store/internal/contact-messages", {
    method: "POST",
    headers: getInternalSecretHeader(),
    body: JSON.stringify(payload),
  });
}

export async function sendContactSubmissionEmails(
  payload: ContactSubmissionEmailPayload,
): Promise<{ ok: boolean; sent?: { storeNotification: boolean; customerAutoReply: boolean } }> {
  return medusaFetch("/store/internal/contact-email", {
    method: "POST",
    headers: getInternalSecretHeader(),
    body: JSON.stringify({
      type: "submission",
      ...payload,
    }),
  });
}

export async function sendContactReplyEmail(
  payload: ContactReplyEmailPayload,
): Promise<{ ok: boolean; sent?: { reply: boolean } }> {
  return medusaFetch("/store/internal/contact-email", {
    method: "POST",
    headers: getInternalSecretHeader(),
    body: JSON.stringify({
      type: "reply",
      ...payload,
    }),
  });
}
