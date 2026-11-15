import type { Access, CollectionConfig } from "payload";
import { APIError } from "payload";
import { canDeleteContent, isAdminRole, isShopManagerOrAdmin } from "../access/content";
import { sendContactReplyEmail } from "../lib/contact/contact-service";

export const canReadContactMessages: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isShopManagerOrAdmin(user.role as string);
};

export const canCreateContactMessages: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isAdminRole(user.role as string);
};

export const canUpdateContactMessages: Access = ({ req: { user } }) => {
  if (!user) return false;
  return isShopManagerOrAdmin(user.role as string);
};

export const canDeleteContactMessages: Access = canDeleteContent;

export const canAccessContactAdmin = ({ req: { user } }: { req: { user: any } }): boolean => {
  if (!user) return false;
  return isShopManagerOrAdmin(user.role as string);
};

export const ContactMessages: CollectionConfig = {
  slug: "contact-messages",
  labels: {
    singular: "İletişim Mesajı",
    plural: "İletişim Mesajları",
  },
  admin: {
    hidden: true,
    useAsTitle: "subject",
    defaultColumns: ["subject", "name", "status", "createdAt"],
    group: "Müşteri İletişimi",
  },
  access: {
    read: canReadContactMessages,
    create: canCreateContactMessages,
    update: canUpdateContactMessages,
    delete: canDeleteContactMessages,
    admin: canAccessContactAdmin,
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      label: "Gönderen Ad Soyad",
      admin: { readOnly: true },
    },
    {
      name: "email",
      type: "email",
      required: true,
      label: "Gönderen E-posta",
      admin: { readOnly: true },
    },
    {
      name: "phone",
      type: "text",
      label: "Telefon",
      admin: { readOnly: true },
    },
    {
      name: "subject",
      type: "text",
      required: true,
      label: "Konu",
      admin: { readOnly: true },
    },
    {
      name: "message",
      type: "textarea",
      required: true,
      label: "Mesaj",
      admin: { readOnly: true },
    },
    {
      name: "kvkkAccepted",
      type: "checkbox",
      required: true,
      defaultValue: false,
      label: "KVKK Onayı",
      admin: { readOnly: true },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "new",
      label: "Durum",
      options: [
        { label: "Yeni", value: "new" },
        { label: "İnceleniyor", value: "in_progress" },
        { label: "Yanıtlandı", value: "replied" },
        { label: "Arşivlendi", value: "archived" },
      ],
    },
    {
      name: "replyMessage",
      type: "textarea",
      label: "Müşteriye Yanıt E-postası",
      admin: {
        description:
          "Yanıt metnini yazıp kaydettiğinizde müşteriye e-posta gönderilir ve durum otomatik 'Yanıtlandı' olur.",
      },
    },
    {
      name: "repliedAt",
      type: "date",
      label: "Yanıtlanma Tarihi",
      admin: { readOnly: true },
    },
    {
      name: "repliedBy",
      type: "relationship",
      relationTo: "users",
      label: "Yanıtlayan Yönetici",
      admin: { readOnly: true },
    },
    {
      name: "internalNote",
      type: "textarea",
      label: "Yönetici İç Notu (Müşteriye Gitmez)",
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== "update" || req.context?.skipContactReplyHook) {
          return doc;
        }

        const nextReply = typeof doc.replyMessage === "string" ? doc.replyMessage.trim() : "";
        const prevReply =
          typeof previousDoc?.replyMessage === "string" ? previousDoc.replyMessage.trim() : "";

        if (!nextReply || nextReply === prevReply) {
          return doc;
        }

        let storeName = "Mağaza";
        try {
          const siteSettings = await req.payload.findGlobal({
            slug: "site-settings",
            depth: 0,
          });
          if (siteSettings?.storeName) {
            storeName = String(siteSettings.storeName);
          }
        } catch {
          // Fallback to neutral storeName
        }

        try {
          await sendContactReplyEmail({
            storeName,
            customerName: String(doc.name || "Müşterimiz"),
            customerEmail: String(doc.email),
            originalSubject: String(doc.subject || "İletişim Talebi"),
            replyMessage: nextReply,
          });
        } catch (err: any) {
          throw new APIError(
            `Yanıt e-postası gönderilemedi: ${err?.message || "SMTP hatası"}`,
            502,
          );
        }

        await req.payload.update({
          collection: "contact-messages",
          id: doc.id,
          overrideAccess: true,
          context: { skipContactReplyHook: true },
          data: {
            status: "replied",
            repliedAt: new Date().toISOString(),
            repliedBy: req.user?.id ?? doc.repliedBy ?? null,
          },
        });

        return doc;
      },
    ],
  },
};
