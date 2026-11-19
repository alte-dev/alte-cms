import { safeHref } from "./safe-href";

export const COOKIE_CONSENT_NAME = "alte_cookie_consent";
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180; // 180 days
export const COOKIE_CONSENT_CHANGE_EVENT = "alte:cookie-consent-change";

const MAX_COOKIE_LENGTH = 1024;

export type CookieConsentCategory = "necessary" | "functional" | "analytics" | "marketing";
export type OptionalCookieConsentCategory = Exclude<CookieConsentCategory, "necessary">;

export interface CookieConsentChoices {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

export interface CookieConsentState extends CookieConsentChoices {
  v: number;
  necessary: true;
  updatedAt: string;
}

export interface CookieConsentConfig {
  enabled: boolean;
  policyVersion: number;
  bannerTitle: string;
  bannerDescription: string;
  policyUrl: string;
}

export const DEFAULT_COOKIE_CONSENT_CONFIG: CookieConsentConfig = {
  enabled: true,
  policyVersion: 1,
  bannerTitle: "Çerez Tercihleriniz",
  bannerDescription:
    "Sitemizin düzgün çalışması için zorunlu çerezler kullanıyoruz. İzninizle harita, analitik ve pazarlama çerezlerini de etkinleştirebilirsiniz.",
  policyUrl: "/sayfa/cerez-politikasi",
};

function normalizeVersion(version: unknown): number {
  if (typeof version !== "number" || !Number.isFinite(version)) return 1;
  const floored = Math.floor(version);
  return floored >= 1 ? floored : 1;
}

export function createConsentState(
  choices: CookieConsentChoices,
  policyVersion: number,
  now: Date = new Date(),
): CookieConsentState {
  return {
    v: normalizeVersion(policyVersion),
    necessary: true,
    functional: Boolean(choices.functional),
    analytics: Boolean(choices.analytics),
    marketing: Boolean(choices.marketing),
    updatedAt: now.toISOString(),
  };
}

export function serializeCookieConsent(state: CookieConsentState): string {
  return encodeURIComponent(
    JSON.stringify({
      v: normalizeVersion(state.v),
      necessary: true,
      functional: Boolean(state.functional),
      analytics: Boolean(state.analytics),
      marketing: Boolean(state.marketing),
      updatedAt: state.updatedAt,
    }),
  );
}

export function parseCookieConsent(raw: string | undefined | null): CookieConsentState | null {
  if (!raw || typeof raw !== "string" || raw.length > MAX_COOKIE_LENGTH) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(raw);
    const parsed: unknown = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (
      typeof record.v !== "number" ||
      !Number.isInteger(record.v) ||
      record.v < 1 ||
      record.necessary !== true ||
      typeof record.functional !== "boolean" ||
      typeof record.analytics !== "boolean" ||
      typeof record.marketing !== "boolean" ||
      typeof record.updatedAt !== "string" ||
      record.updatedAt.length === 0 ||
      record.updatedAt.length > 64
    ) {
      return null;
    }

    return {
      v: record.v,
      necessary: true,
      functional: record.functional,
      analytics: record.analytics,
      marketing: record.marketing,
      updatedAt: record.updatedAt,
    };
  } catch {
    return null;
  }
}

export function isConsentCurrent(
  consent: CookieConsentState | null,
  policyVersion: number,
): boolean {
  if (!consent) return false;
  return consent.v >= normalizeVersion(policyVersion);
}

export function hasCategoryConsent(
  consent: CookieConsentState | null,
  category: CookieConsentCategory,
  policyVersion: number,
): boolean {
  if (category === "necessary") return true;
  if (!isConsentCurrent(consent, policyVersion)) return false;
  return Boolean(consent?.[category]);
}

export function resolveCookieConsentConfig(
  raw:
    | {
        enabled?: boolean | null;
        policyVersion?: number | null;
        bannerTitle?: string | null;
        bannerDescription?: string | null;
        policyUrl?: string | null;
      }
    | null
    | undefined,
): CookieConsentConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_COOKIE_CONSENT_CONFIG };
  }

  const enabled =
    typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_COOKIE_CONSENT_CONFIG.enabled;
  const policyVersion =
    typeof raw.policyVersion === "number" && Number.isFinite(raw.policyVersion)
      ? normalizeVersion(raw.policyVersion)
      : DEFAULT_COOKIE_CONSENT_CONFIG.policyVersion;
  const bannerTitle =
    typeof raw.bannerTitle === "string" && raw.bannerTitle.trim().length > 0
      ? raw.bannerTitle.trim()
      : DEFAULT_COOKIE_CONSENT_CONFIG.bannerTitle;
  const bannerDescription =
    typeof raw.bannerDescription === "string" && raw.bannerDescription.trim().length > 0
      ? raw.bannerDescription.trim()
      : DEFAULT_COOKIE_CONSENT_CONFIG.bannerDescription;
  const policyUrl = safeHref(raw.policyUrl, DEFAULT_COOKIE_CONSENT_CONFIG.policyUrl);

  return {
    enabled,
    policyVersion,
    bannerTitle,
    bannerDescription,
    policyUrl,
  };
}

export function buildConsentCookieString(state: CookieConsentState, isHttps: boolean): string {
  const value = serializeCookieConsent(state);
  const parts = [
    `${COOKIE_CONSENT_NAME}=${value}`,
    "Path=/",
    `Max-Age=${COOKIE_CONSENT_MAX_AGE}`,
    "SameSite=Lax",
  ];
  if (isHttps) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
