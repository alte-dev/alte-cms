import React from "react";
import type { Metadata } from "next";
import { getPublishedPageBySlug, getSiteSettings } from "@/lib/payload/content";
import { ContactFormClient } from "@/components/contact/ContactFormClient";
import { RenderPuckContent } from "@/lib/puck/render";
import { safeParsePuckData } from "@/lib/puck/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İletişim",
  description:
    "Sorularınız, siparişleriniz ve iş birliği talepleriniz için bizimle iletişime geçin.",
};

export default async function IletisimPage() {
  const [pageDoc, siteSettings] = await Promise.all([
    getPublishedPageBySlug("iletisim"),
    getSiteSettings() as Promise<any>,
  ]);

  const safePuck =
    pageDoc && pageDoc._status === "published" ? safeParsePuckData(pageDoc.puckData) : null;

  if (safePuck) {
    return (
      <article className="w-full">
        <RenderPuckContent data={safePuck} />
      </article>
    );
  }

  const storeName = String(siteSettings?.storeName || "Mağaza");
  const contactEmail =
    typeof siteSettings?.contactEmail === "string" ? siteSettings.contactEmail : "";
  const contactPhone =
    typeof siteSettings?.contactPhone === "string" ? siteSettings.contactPhone : "";
  const address = typeof siteSettings?.address === "string" ? siteSettings.address : "";

  const contactFormConfig = siteSettings?.contactForm ?? {};
  const enabled = contactFormConfig.enabled !== false;
  const subjectOptions: string[] = Array.isArray(contactFormConfig.subjectOptions)
    ? contactFormConfig.subjectOptions
        .map((item: any) => (typeof item?.label === "string" ? item.label.trim() : ""))
        .filter(Boolean)
    : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">İletişim</h1>
        <p className="mt-2 text-base text-slate-600">
          {storeName} ile ilgili soru, öneri ve destek talepleriniz için bize ulaşabilirsiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section
          aria-label="Mağaza iletişim bilgileri"
          className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 lg:col-span-1"
        >
          <h2 className="text-lg font-semibold text-slate-900">İletişim Bilgileri</h2>
          {address ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adres</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{address}</p>
            </div>
          ) : null}
          {contactPhone ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Telefon
              </p>
              <p className="mt-1 text-sm text-slate-800">{contactPhone}</p>
            </div>
          ) : null}
          {contactEmail ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                E-posta
              </p>
              <p className="mt-1 text-sm text-slate-800">{contactEmail}</p>
            </div>
          ) : null}
          {!address && !contactPhone && !contactEmail ? (
            <p className="text-sm text-slate-600">
              Yandaki formu doldurarak ekibimize doğrudan mesaj gönderebilirsiniz.
            </p>
          ) : null}
        </section>

        <section
          aria-label="İletişim formu"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-2"
        >
          <h2 className="mb-5 text-lg font-semibold text-slate-900">Bize Yazın</h2>
          <ContactFormClient subjectOptions={subjectOptions} enabled={enabled} />
        </section>
      </div>
    </main>
  );
}
