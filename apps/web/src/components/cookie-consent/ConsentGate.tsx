"use client";

import React from "react";
import type { CookieConsentCategory } from "../../lib/cookie-consent";
import { useCookieConsent } from "./CookieConsentProvider";

export interface ConsentGateProps {
  category: CookieConsentCategory;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ConsentGate({ category, fallback = null, children }: ConsentGateProps) {
  const { hasConsent } = useCookieConsent();
  if (!hasConsent(category)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
