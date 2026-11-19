import { describe, expect, it } from "vitest";
import {
  COOKIE_CONSENT_MAX_AGE,
  COOKIE_CONSENT_NAME,
  DEFAULT_COOKIE_CONSENT_CONFIG,
  buildConsentCookieString,
  createConsentState,
  hasCategoryConsent,
  isConsentCurrent,
  parseCookieConsent,
  resolveCookieConsentConfig,
  serializeCookieConsent,
} from "./cookie-consent";

describe("cookie-consent core logic", () => {
  it("serializes and parses a valid consent state round-trip", () => {
    const now = new Date("2026-11-19T12:00:00.000Z");
    const state = createConsentState(
      { functional: true, analytics: false, marketing: false },
      2,
      now,
    );
    expect(state).toEqual({
      v: 2,
      necessary: true,
      functional: true,
      analytics: false,
      marketing: false,
      updatedAt: "2026-11-19T12:00:00.000Z",
    });

    const raw = serializeCookieConsent(state);
    expect(parseCookieConsent(raw)).toEqual(state);
  });

  it("returns null (fail-closed) for empty, malformed, oversized, or tampered cookies", () => {
    expect(parseCookieConsent(null)).toBeNull();
    expect(parseCookieConsent(undefined)).toBeNull();
    expect(parseCookieConsent("")).toBeNull();
    expect(parseCookieConsent("not-json")).toBeNull();
    expect(parseCookieConsent("%E0%A4%A")).toBeNull(); // invalid URI encoding
    expect(parseCookieConsent("x".repeat(1025))).toBeNull();
    // necessary must be strictly true
    expect(
      parseCookieConsent(
        encodeURIComponent(
          JSON.stringify({
            v: 1,
            necessary: false,
            functional: true,
            analytics: false,
            marketing: false,
            updatedAt: "2026-11-19T12:00:00.000Z",
          }),
        ),
      ),
    ).toBeNull();
    // version must be positive integer
    expect(
      parseCookieConsent(
        encodeURIComponent(
          JSON.stringify({
            v: 0,
            necessary: true,
            functional: true,
            analytics: false,
            marketing: false,
            updatedAt: "2026-11-19T12:00:00.000Z",
          }),
        ),
      ),
    ).toBeNull();
    // non-boolean category value rejected
    expect(
      parseCookieConsent(
        encodeURIComponent(
          JSON.stringify({
            v: 1,
            necessary: true,
            functional: "yes",
            analytics: false,
            marketing: false,
            updatedAt: "2026-11-19T12:00:00.000Z",
          }),
        ),
      ),
    ).toBeNull();
  });

  it("evaluates version currency and category consent fail-closed", () => {
    const v1 = createConsentState(
      { functional: true, analytics: true, marketing: false },
      1,
      new Date("2026-11-19T12:00:00.000Z"),
    );

    expect(isConsentCurrent(null, 1)).toBe(false);
    expect(isConsentCurrent(v1, 1)).toBe(true);
    expect(isConsentCurrent(v1, 2)).toBe(false);

    // Necessary is always allowed
    expect(hasCategoryConsent(null, "necessary", 1)).toBe(true);
    expect(hasCategoryConsent(v1, "necessary", 2)).toBe(true);

    // Optional categories require current consent
    expect(hasCategoryConsent(null, "functional", 1)).toBe(false);
    expect(hasCategoryConsent(v1, "functional", 1)).toBe(true);
    expect(hasCategoryConsent(v1, "analytics", 1)).toBe(true);
    expect(hasCategoryConsent(v1, "marketing", 1)).toBe(false);

    // Outdated policy version revokes optional categories until re-consented
    expect(hasCategoryConsent(v1, "functional", 2)).toBe(false);
    expect(hasCategoryConsent(v1, "analytics", 2)).toBe(false);
  });

  it("sanitizes SiteSettings cookieConsent config and blocks unsafe policy URLs", () => {
    expect(resolveCookieConsentConfig(null)).toEqual(DEFAULT_COOKIE_CONSENT_CONFIG);

    const safe = resolveCookieConsentConfig({
      enabled: false,
      policyVersion: 3,
      bannerTitle: "Özel Başlık",
      bannerDescription: "Özel açıklama.",
      policyUrl: "/sayfa/ozel-cerez",
    });
    expect(safe).toEqual({
      enabled: false,
      policyVersion: 3,
      bannerTitle: "Özel Başlık",
      bannerDescription: "Özel açıklama.",
      policyUrl: "/sayfa/ozel-cerez",
    });

    const httpsUrl = resolveCookieConsentConfig({
      policyUrl: "https://example.test/cerez",
    });
    expect(httpsUrl.policyUrl).toBe("https://example.test/cerez");

    for (const badUrl of ["javascript:alert(1)", "data:text/html,hi", "//evil.test/x"]) {
      const resolved = resolveCookieConsentConfig({ policyUrl: badUrl });
      expect(resolved.policyUrl).toBe(DEFAULT_COOKIE_CONSENT_CONFIG.policyUrl);
    }
  });

  it("builds Set-Cookie / document.cookie string with secure flags", () => {
    const state = createConsentState(
      { functional: false, analytics: false, marketing: false },
      1,
      new Date("2026-11-19T12:00:00.000Z"),
    );
    const httpCookie = buildConsentCookieString(state, false);
    expect(httpCookie).toContain(`${COOKIE_CONSENT_NAME}=`);
    expect(httpCookie).toContain(`Max-Age=${COOKIE_CONSENT_MAX_AGE}`);
    expect(httpCookie).toContain("Path=/");
    expect(httpCookie).toContain("SameSite=Lax");
    expect(httpCookie).not.toContain("Secure");

    const httpsCookie = buildConsentCookieString(state, true);
    expect(httpsCookie).toContain("; Secure");
  });
});
