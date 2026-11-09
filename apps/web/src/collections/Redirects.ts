import type { CollectionConfig } from "payload";
import {
  validateRedirectEndpoints,
  isCircularRedirect,
  normalizeRedirectPath,
  type RedirectRecord,
} from "../lib/redirect-checker";
import { canDeleteContent } from "../access/content";

export const Redirects: CollectionConfig = {
  slug: "redirects",
  admin: {
    useAsTitle: "from",
    defaultColumns: ["from", "to", "type", "updatedAt"],
  },
  access: {
    // Redirects lookup is public so middleware / storefront can resolve redirects
    read: () => true,
    // Only Admin / Super-Admin can manage redirects
    create: canDeleteContent,
    update: canDeleteContent,
    delete: canDeleteContent,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (data?.from && data?.to) {
          const result = validateRedirectEndpoints(data.from, data.to);
          if (!result.valid) {
            throw new Error(`Geçersiz yönlendirme kuralı: ${result.error}`);
          }
          data.from = result.normalizedFrom;
          data.to = result.normalizedTo;
        }
        return data;
      },
    ],
    beforeChange: [
      async ({ req, data, originalDoc }) => {
        if (data?.from && data?.to) {
          // Normalize paths
          const from = normalizeRedirectPath(data.from);
          const to = data.to.startsWith("https://") ? data.to : normalizeRedirectPath(data.to);

          // Query existing redirects to check for circular chains (e.g. A -> B and B -> A)
          try {
            const allRedirects = await req.payload.find({
              collection: "redirects",
              limit: 500,
              depth: 0,
            });

            // Filter out current doc being updated
            const existingRecords: RedirectRecord[] = allRedirects.docs
              .filter((doc) => !originalDoc?.id || doc.id !== originalDoc.id)
              .map((doc) => ({
                from: doc.from as string,
                to: doc.to as string,
              }));

            if (isCircularRedirect(from, to, existingRecords)) {
              throw new Error(
                `Döngüsel yönlendirme tespit edildi! '${from}' -> '${to}' kuralı sonsuz bir yönlendirme döngüsüne yol açacaktır.`,
              );
            }
          } catch (err: any) {
            if (err?.message?.includes("Döngüsel yönlendirme")) {
              throw err;
            }
            req.payload.logger.warn({
              msg: "Could not verify circular redirects against existing records",
              err,
            });
          }
        }
        return data;
      },
    ],
  },
  fields: [
    {
      name: "from",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: "Eski Yol (Kaynak)",
      admin: {
        description: "'/' ile başlamalıdır (örn: /eski-kategori/eski-sayfa).",
      },
    },
    {
      name: "to",
      type: "text",
      required: true,
      label: "Yeni Yol (Hedef)",
      admin: {
        description: "İç bağlantı (/yeni-sayfa) veya güvenli dış adres (https://...).",
      },
    },
    {
      name: "type",
      type: "select",
      required: true,
      defaultValue: "301",
      label: "Yönlendirme Türü",
      options: [
        { label: "301 - Kalıcı (Permanent Redirect - SEO Dostu)", value: "301" },
        { label: "302 - Geçici (Temporary Redirect)", value: "302" },
      ],
    },
  ],
};
