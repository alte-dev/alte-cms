"use client";

import React from "react";
import { ContactFormClient } from "../../../components/contact/ContactFormClient";

export interface ContactFormBlockProps {
  title?: string;
  subtitle?: string;
  layout?: "full" | "split-left" | "split-right";
  sideTitle?: string;
  sideText?: string;
  email?: string;
  phone?: string;
  address?: string;
  workingHours?: string;
}

export function ContactFormBlockComponent({
  title = "Bize Yazın",
  subtitle,
  layout = "split-left",
  sideTitle = "İletişim Bilgileri",
  sideText,
  email,
  phone,
  address,
  workingHours,
}: ContactFormBlockProps) {
  const hasDetails = Boolean(sideText || email || phone || address || workingHours);
  const isSplit = layout !== "full" && hasDetails;

  const formSection = (
    <section
      aria-label={title}
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 ${
        isSplit ? "lg:col-span-2" : ""
      }`}
    >
      {title && <h2 className="text-lg font-semibold text-slate-900 mb-2">{title}</h2>}
      {subtitle && <p className="text-sm text-slate-600 mb-5">{subtitle}</p>}
      {!subtitle && title && <div className="mb-3" />}
      <ContactFormClient subjectOptions={[]} enabled={true} />
    </section>
  );

  const infoSection = isSplit ? (
    <section
      aria-label={sideTitle}
      className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 lg:col-span-1"
    >
      {sideTitle && <h2 className="text-lg font-semibold text-slate-900">{sideTitle}</h2>}
      {sideText && <p className="text-sm text-slate-600 whitespace-pre-line">{sideText}</p>}
      {address && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Adres</p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{address}</p>
        </div>
      )}
      {phone && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Telefon</p>
          <a
            href={`tel:${phone.replace(/[^+\d]/g, "")}`}
            className="mt-1 inline-block text-sm font-medium text-slate-900 hover:underline"
          >
            {phone}
          </a>
        </div>
      )}
      {email && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">E-posta</p>
          <a
            href={`mailto:${email}`}
            className="mt-1 inline-block text-sm font-medium text-slate-900 hover:underline"
          >
            {email}
          </a>
        </div>
      )}
      {workingHours && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Çalışma Saatleri
          </p>
          <p className="mt-1 text-sm text-slate-800">{workingHours}</p>
        </div>
      )}
      {address && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <iframe
            title="Mağaza Konumu"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
            className="h-48 w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </section>
  ) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {isSplit ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {layout === "split-left" ? (
            <>
              {infoSection}
              {formSection}
            </>
          ) : (
            <>
              {formSection}
              {infoSection}
            </>
          )}
        </div>
      ) : (
        formSection
      )}
    </div>
  );
}
