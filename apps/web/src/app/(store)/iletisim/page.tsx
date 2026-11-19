import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { getPublishedPageBySlug, getSiteSettings } from "@/lib/payload/content";
import { ContactFormClient } from "@/components/contact/ContactFormClient";
import { GoogleMapConsentFrame } from "@/components/cookie-consent/GoogleMapConsentFrame";
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
    typeof siteSettings?.contactEmail === "string" ? siteSettings.contactEmail.trim() : "";
  const contactPhone =
    typeof siteSettings?.contactPhone === "string" ? siteSettings.contactPhone.trim() : "";
  const address = typeof siteSettings?.address === "string" ? siteSettings.address.trim() : "";

  const contactFormConfig = siteSettings?.contactForm ?? {};
  const enabled = contactFormConfig.enabled !== false;
  const pageTitle = String(contactFormConfig.pageTitle || "Bizimle İletişime Geçin");
  const pageSubtitle = String(
    contactFormConfig.pageSubtitle ||
      `${storeName} ile ilgili soru, öneri ve destek talepleriniz için bize ulaşabilirsiniz.`,
  );
  const topContent =
    typeof contactFormConfig.topContent === "string" ? contactFormConfig.topContent.trim() : "";
  const bottomContent =
    typeof contactFormConfig.bottomContent === "string"
      ? contactFormConfig.bottomContent.trim()
      : "Müşteri temsilcilerimiz ilettiğiniz tüm taleplere iş günleri içinde en geç 24 saat içerisinde dönüş yapmaktadır.";
  const workingHours =
    typeof contactFormConfig.workingHours === "string"
      ? contactFormConfig.workingHours.trim()
      : "Hafta içi: 09:00 - 18:00";
  const showMap = contactFormConfig.showMap !== false;
  const mapLocation =
    (typeof contactFormConfig.mapQuery === "string" && contactFormConfig.mapQuery.trim()) ||
    address;

  const subjectOptions: string[] = Array.isArray(contactFormConfig.subjectOptions)
    ? contactFormConfig.subjectOptions
        .map((item: any) => (typeof item?.label === "string" ? item.label.trim() : ""))
        .filter(Boolean)
    : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {storeName}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {pageTitle}
        </h1>
        <p className="mt-3 text-base text-slate-600">{pageSubtitle}</p>
      </header>

      {topContent ? (
        <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-4 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
          {topContent}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <aside aria-label="Mağaza iletişim bilgileri ve harita" className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">İletişim Bilgileri</h2>

            {address ? (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Adres
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{address}</p>
                </div>
              </div>
            ) : null}

            {contactPhone ? (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Telefon
                  </p>
                  <a
                    href={`tel:${contactPhone.replace(/[^+\d]/g, "")}`}
                    className="mt-1 inline-block text-sm font-medium text-slate-900 hover:underline"
                  >
                    {contactPhone}
                  </a>
                </div>
              </div>
            ) : null}

            {contactEmail ? (
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    E-posta
                  </p>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="mt-1 inline-block text-sm font-medium text-slate-900 hover:underline"
                  >
                    {contactEmail}
                  </a>
                </div>
              </div>
            ) : null}

            {workingHours ? (
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Çalışma Saatleri
                  </p>
                  <p className="mt-1 text-sm text-slate-800">{workingHours}</p>
                </div>
              </div>
            ) : null}
          </div>

          {showMap && mapLocation ? (
            <GoogleMapConsentFrame
              title={`${storeName} Konum Haritası`}
              mapLocation={mapLocation}
            />
          ) : null}
        </aside>

        <section
          aria-label="İletişim formu"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-7"
        >
          <h2 className="mb-5 text-lg font-semibold text-slate-900">Bize Yazın</h2>
          <ContactFormClient subjectOptions={subjectOptions} enabled={enabled} />
        </section>
      </div>

      {bottomContent ? (
        <section
          aria-label="Ek bilgilendirme"
          className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:flex-row sm:items-center"
        >
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
            {bottomContent}
          </p>
          <Link
            href="/urunler"
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
          >
            Mağazaya Dön
          </Link>
        </section>
      ) : null}
    </main>
  );
}
