"use client";

import React from "react";
import Link from "next/link";
import { useCookieConsent } from "./CookieConsentProvider";

export function CookieConsentBanner() {
  const { config, acceptAll, rejectAll, openPreferences } = useCookieConsent();
  const isExternalPolicy = config.policyUrl.startsWith("https://");

  return (
    <aside
      role="region"
      aria-label="Çerez Tercihleri"
      data-testid="cookie-consent-banner"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white shadow-[0_-6px_28px_rgba(0,0,0,0.08)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div className="max-w-3xl space-y-1">
          <p className="text-sm font-semibold text-stone-900">{config.bannerTitle}</p>
          <p className="text-xs leading-relaxed text-stone-700 sm:text-sm">
            {config.bannerDescription}{" "}
            {isExternalPolicy ? (
              <a
                href={config.policyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-stone-900 underline underline-offset-2 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 rounded"
              >
                Çerez Politikası
              </a>
            ) : (
              <Link
                href={config.policyUrl}
                className="font-medium text-stone-900 underline underline-offset-2 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 rounded"
              >
                Çerez Politikası
              </Link>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:shrink-0">
          <button
            type="button"
            onClick={openPreferences}
            data-testid="cookie-manage-preferences"
            className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-800 transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 sm:text-sm"
          >
            Tercihleri Yönet
          </button>
          <button
            type="button"
            onClick={rejectAll}
            data-testid="cookie-reject-all"
            className="inline-flex items-center justify-center rounded-lg border border-stone-900 bg-white px-4 py-2.5 text-xs font-semibold text-stone-900 transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 sm:text-sm"
          >
            Tümünü Reddet
          </button>
          <button
            type="button"
            onClick={acceptAll}
            data-testid="cookie-accept-all"
            className="inline-flex items-center justify-center rounded-lg border border-stone-900 bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 sm:text-sm"
          >
            Tümünü Kabul Et
          </button>
        </div>
      </div>
    </aside>
  );
}
