import { cookies } from "next/headers";
import { COOKIE_CONSENT_NAME, parseCookieConsent, type CookieConsentState } from "./cookie-consent";

export async function getServerCookieConsent(): Promise<CookieConsentState | null> {
  const cookieStore = await cookies();
  return parseCookieConsent(cookieStore.get(COOKIE_CONSENT_NAME)?.value);
}
