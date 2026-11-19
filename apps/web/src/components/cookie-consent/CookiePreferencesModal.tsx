"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  isConsentCurrent,
  type CookieConsentChoices,
  type OptionalCookieConsentCategory,
} from "../../lib/cookie-consent";
import { useCookieConsent } from "./CookieConsentProvider";

interface CategoryMeta {
  key: OptionalCookieConsentCategory;
  title: string;
  description: string;
}

const OPTIONAL_CATEGORIES: CategoryMeta[] = [
  {
    key: "functional",
    title: "İşlevsel ve Üçüncü Parti Çerezler",
    description:
      "İletişim sayfasındaki Google Haritası gibi harici gömülü içeriklerin çalışması için kullanılır.",
  },
  {
    key: "analytics",
    title: "Analitik ve Performans Çerezleri",
    description:
      "Ziyaretçi trafiğini ve sayfa performansını ölçerek site deneyimini iyileştirmemize yardımcı olur.",
  },
  {
    key: "marketing",
    title: "Pazarlama ve Reklam Çerezleri",
    description: "İlgi alanlarınıza yönelik kampanya ve reklam ölçümü için kullanılır.",
  },
];

export function CookiePreferencesModal() {
  const { consent, config, acceptAll, rejectAll, savePreferences, closePreferences } =
    useCookieConsent();

  const currentValid = isConsentCurrent(consent, config.policyVersion);
  const [draft, setDraft] = useState<CookieConsentChoices>(() =>
    currentValid && consent
      ? {
          functional: consent.functional,
          analytics: consent.analytics,
          marketing: consent.marketing,
        }
      : { functional: false, analytics: false, marketing: false },
  );

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePreferences();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [closePreferences]);

  const toggleCategory = (key: OptionalCookieConsentCategory) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isExternalPolicy = config.policyUrl.startsWith("https://");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) closePreferences();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-preferences-title"
        data-testid="cookie-preferences-modal"
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-4">
          <div>
            <h2 id="cookie-preferences-title" className="text-lg font-semibold text-stone-900">
              Çerez Tercihlerini Yönet
            </h2>
            <p className="mt-1 text-xs text-stone-600">
              Zorunlu çerezler dışındaki tüm kategoriler varsayılan olarak kapalıdır. Ayrıntılar
              için{" "}
              {isExternalPolicy ? (
                <a
                  href={config.policyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-stone-900 underline underline-offset-2 hover:text-stone-700"
                >
                  Çerez Politikası
                </a>
              ) : (
                <Link
                  href={config.policyUrl}
                  onClick={closePreferences}
                  className="font-medium text-stone-900 underline underline-offset-2 hover:text-stone-700"
                >
                  Çerez Politikası
                </Link>
              )}{" "}
              sayfasını inceleyebilirsiniz.
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closePreferences}
            aria-label="Çerez tercihleri penceresini kapat"
            className="rounded-lg p-2 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
          >
            <span aria-hidden="true" className="block text-lg leading-none">
              ✕
            </span>
          </button>
        </div>

        <div className="divide-y divide-stone-200 px-6 py-2">
          {/* Strictly necessary cookies — always active */}
          <div className="flex items-start justify-between gap-4 py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-stone-900">Zorunlu Çerezler</h3>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                  Her zaman aktif
                </span>
              </div>
              <p className="text-xs leading-relaxed text-stone-600">
                Sepet, müşteri oturumu, sipariş onayı ve çerez tercihlerinizin güvenle çalışması
                için gereklidir; kapatılamaz.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={true}
              aria-label="Zorunlu Çerezler (her zaman aktif)"
              disabled
              className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-not-allowed items-center rounded-full bg-stone-900 opacity-60"
            >
              <span className="inline-block h-4 w-4 translate-x-6 rounded-full bg-white transition" />
            </button>
          </div>

          {OPTIONAL_CATEGORIES.map((category) => {
            const enabled = draft[category.key];
            return (
              <div key={category.key} className="flex items-start justify-between gap-4 py-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-stone-900">{category.title}</h3>
                  <p className="text-xs leading-relaxed text-stone-600">{category.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={category.title}
                  data-testid={`cookie-toggle-${category.key}`}
                  onClick={() => toggleCategory(category.key)}
                  className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 ${
                    enabled ? "bg-stone-900" : "bg-stone-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition ${
                      enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-stone-200 bg-stone-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={rejectAll}
            data-testid="cookie-modal-reject-all"
            className="inline-flex items-center justify-center rounded-lg border border-stone-900 bg-white px-4 py-2 text-xs font-semibold text-stone-900 transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 sm:text-sm"
          >
            Tümünü Reddet
          </button>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => savePreferences(draft)}
              data-testid="cookie-modal-save"
              className="inline-flex items-center justify-center rounded-lg border border-stone-400 bg-white px-4 py-2 text-xs font-semibold text-stone-900 transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 sm:text-sm"
            >
              Tercihleri Kaydet
            </button>
            <button
              type="button"
              onClick={acceptAll}
              data-testid="cookie-modal-accept-all"
              className="inline-flex items-center justify-center rounded-lg border border-stone-900 bg-stone-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 sm:text-sm"
            >
              Tümünü Kabul Et
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
