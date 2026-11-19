"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  DEFAULT_COOKIE_CONSENT_CONFIG,
  buildConsentCookieString,
  createConsentState,
  hasCategoryConsent,
  isConsentCurrent,
  type CookieConsentCategory,
  type CookieConsentChoices,
  type CookieConsentConfig,
  type CookieConsentState,
  type OptionalCookieConsentCategory,
} from "../../lib/cookie-consent";
import { CookieConsentBanner } from "./CookieConsentBanner";
import { CookiePreferencesModal } from "./CookiePreferencesModal";

export interface CookieConsentContextValue {
  consent: CookieConsentState | null;
  config: CookieConsentConfig;
  isBannerVisible: boolean;
  isModalOpen: boolean;
  hasConsent: (category: CookieConsentCategory) => boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (choices: CookieConsentChoices) => void;
  grantCategory: (category: OptionalCookieConsentCategory) => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

function persistConsentCookie(state: CookieConsentState): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const isHttps = window.location.protocol === "https:";
  document.cookie = buildConsentCookieString(state, isHttps);
  window.dispatchEvent(
    new CustomEvent<CookieConsentState>(COOKIE_CONSENT_CHANGE_EVENT, { detail: state }),
  );
}

export interface CookieConsentProviderProps {
  initialConsent: CookieConsentState | null;
  config?: CookieConsentConfig;
  children: React.ReactNode;
}

export function CookieConsentProvider({
  initialConsent,
  config = DEFAULT_COOKIE_CONSENT_CONFIG,
  children,
}: CookieConsentProviderProps) {
  const [consent, setConsent] = useState<CookieConsentState | null>(initialConsent);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const commitChoices = useCallback(
    (choices: CookieConsentChoices) => {
      const next = createConsentState(choices, config.policyVersion);
      persistConsentCookie(next);
      setConsent(next);
      setIsModalOpen(false);
    },
    [config.policyVersion],
  );

  const acceptAll = useCallback(() => {
    commitChoices({ functional: true, analytics: true, marketing: true });
  }, [commitChoices]);

  const rejectAll = useCallback(() => {
    commitChoices({ functional: false, analytics: false, marketing: false });
  }, [commitChoices]);

  const savePreferences = useCallback(
    (choices: CookieConsentChoices) => {
      commitChoices(choices);
    },
    [commitChoices],
  );

  const grantCategory = useCallback(
    (category: OptionalCookieConsentCategory) => {
      const currentValid = isConsentCurrent(consent, config.policyVersion);
      const base: CookieConsentChoices =
        currentValid && consent
          ? {
              functional: consent.functional,
              analytics: consent.analytics,
              marketing: consent.marketing,
            }
          : { functional: false, analytics: false, marketing: false };

      commitChoices({
        ...base,
        [category]: true,
      });
    },
    [commitChoices, consent, config.policyVersion],
  );

  const openPreferences = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const hasConsent = useCallback(
    (category: CookieConsentCategory) =>
      hasCategoryConsent(consent, category, config.policyVersion),
    [consent, config.policyVersion],
  );

  const isBannerVisible =
    config.enabled && !isModalOpen && !isConsentCurrent(consent, config.policyVersion);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      config,
      isBannerVisible,
      isModalOpen,
      hasConsent,
      acceptAll,
      rejectAll,
      savePreferences,
      grantCategory,
      openPreferences,
      closePreferences,
    }),
    [
      consent,
      config,
      isBannerVisible,
      isModalOpen,
      hasConsent,
      acceptAll,
      rejectAll,
      savePreferences,
      grantCategory,
      openPreferences,
      closePreferences,
    ],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {isBannerVisible ? <CookieConsentBanner /> : null}
      {isModalOpen ? <CookiePreferencesModal /> : null}
    </CookieConsentContext.Provider>
  );
}

export function useOptionalCookieConsent(): CookieConsentContextValue | null {
  return useContext(CookieConsentContext);
}

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) {
    throw new Error("useCookieConsent must be used within a CookieConsentProvider");
  }
  return ctx;
}
