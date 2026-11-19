"use client";

import React from "react";
import { useOptionalCookieConsent } from "./CookieConsentProvider";

export interface GoogleMapConsentFrameProps {
  title: string;
  mapLocation: string;
  heightClassName?: string;
}

export function GoogleMapConsentFrame({
  title,
  mapLocation,
  heightClassName = "h-64",
}: GoogleMapConsentFrameProps) {
  const ctx = useOptionalCookieConsent();
  const allowed = ctx ? ctx.hasConsent("functional") : false;

  if (allowed) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
        <iframe
          title={title}
          src={`https://maps.google.com/maps?q=${encodeURIComponent(mapLocation)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
          className={`${heightClassName} w-full border-0`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }

  return (
    <div
      data-testid="google-map-consent-placeholder"
      className="flex flex-col items-start justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
    >
      <p className="text-sm font-semibold text-slate-900">Harita içeriği çerez izni bekliyor</p>
      <p className="text-xs leading-relaxed text-slate-600">
        Google Haritası üçüncü parti içerik yükler. Haritayı görüntülemek için işlevsel çerezleri
        onaylayabilirsiniz.
      </p>
      {ctx ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => ctx.grantCategory("functional")}
            data-testid="google-map-grant-consent"
            className="inline-flex items-center justify-center rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          >
            Haritayı Göster
          </button>
          <button
            type="button"
            onClick={ctx.openPreferences}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
          >
            Çerez Tercihleri
          </button>
        </div>
      ) : null}
    </div>
  );
}
