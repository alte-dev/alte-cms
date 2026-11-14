import crypto from "crypto";
import { getPayloadClient } from "./content";

export const MARKETING_CONSENT_TEXT =
  "Kampanya, indirim ve yeni ürün duyurularını e-posta ile almak istiyorum (isteğe bağlı).";

export function getMarketingConsentVersion(): string {
  const hash = crypto.createHash("sha256").update(MARKETING_CONSENT_TEXT, "utf8").digest("hex");
  return `marketing:${hash.slice(0, 16)}`;
}

export async function getKvkkNoticeVersion(): Promise<string> {
  try {
    const payload = await getPayloadClient();
    const res = await payload.find({
      collection: "pages",
      where: {
        and: [{ slug: { equals: "kvkk" } }, { _status: { equals: "published" } }],
      },
      limit: 1,
      depth: 0,
    });
    const doc = res.docs?.[0] as { id?: string | number; updatedAt?: string } | undefined;
    if (doc?.id && doc?.updatedAt) {
      return `kvkk:${String(doc.id)}:${String(doc.updatedAt)}`;
    }
  } catch {
    // Fallback below
  }
  return "kvkk:fallback-template";
}
