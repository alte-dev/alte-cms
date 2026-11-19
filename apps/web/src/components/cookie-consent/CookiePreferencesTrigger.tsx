"use client";

import React from "react";
import { useCookieConsent } from "./CookieConsentProvider";

export function CookiePreferencesTrigger({ className }: { className?: string }) {
  const { openPreferences } = useCookieConsent();

  return (
    <button
      type="button"
      onClick={openPreferences}
      data-testid="cookie-preferences-trigger"
      className={
        className ||
        "text-xs text-stone-300 underline underline-offset-2 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
      }
    >
      Çerez Tercihleri
    </button>
  );
}
