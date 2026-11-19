/**
 * E2E Live Verification Script for KVKK Cookie Consent (Opt-In)
 *
 * Strict LIVE HTTP + Playwright Browser Verification:
 * 1. SSR GET / without consent cookie renders cookie banner (Accept All / Reject All / Manage)
 * 2. SSR GET /iletisim without consent cookie blocks Google Maps iframe (renders placeholder)
 * 3. SSR GET / and /iletisim with valid functional consent cookie hides banner & renders map iframe
 * 4. SSR GET /iletisim with malformed/tampered consent cookie fails closed (blocks map, shows banner)
 * 5. Playwright: Reject All persists cookie (functional/analytics/marketing=false) across reload
 * 6. Playwright: Footer trigger opens preferences modal, enabling functional unlocks /iletisim map
 * 7. Playwright + Axe-core: 0 critical/serious a11y violations with banner open & modal open + Escape closes modal
 */

import path from "path";
import dotenv from "dotenv";
import AxeBuilder from "@axe-core/playwright";
import { createStepRecorder, launchVerifyBrowser } from "./lib/verify-step";

dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/medusa/.env") });
dotenv.config();

const STORE_URL =
  process.env.STOREFRONT_URL ||
  process.env.WEB_URL ||
  process.env.NEXT_PUBLIC_SERVER_URL ||
  "http://localhost:3100";

const COOKIE_NAME = "alte_cookie_consent";
const { results, recordStep } = createStepRecorder({ format: "step" });

function makeConsentCookieHeader(choices: {
  v?: number;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}): string {
  const payload = {
    v: choices.v ?? 1,
    necessary: true,
    functional: choices.functional,
    analytics: choices.analytics,
    marketing: choices.marketing,
    updatedAt: new Date().toISOString(),
  };
  return `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(payload))}`;
}

async function main() {
  console.log(`\n🍪 Başlatılıyor: verify:cookie-consent (${STORE_URL})\n`);

  // 1. SSR GET / without consent cookie
  const homeRes = await fetch(`${STORE_URL}/`);
  const homeHtml = await homeRes.text();
  recordStep(
    "1. SSR GET / rıza çerezi yokken onay bandı + 3 buton + footer tetikleyici",
    homeRes.ok &&
      homeHtml.includes('data-testid="cookie-consent-banner"') &&
      homeHtml.includes('data-testid="cookie-reject-all"') &&
      homeHtml.includes('data-testid="cookie-accept-all"') &&
      homeHtml.includes('data-testid="cookie-manage-preferences"') &&
      homeHtml.includes('data-testid="cookie-preferences-trigger"'),
    `status=${homeRes.status}`,
  );

  // 2. SSR GET /iletisim without consent cookie blocks Google Maps
  const contactNoConsentRes = await fetch(`${STORE_URL}/iletisim`);
  const contactNoConsentHtml = await contactNoConsentRes.text();
  recordStep(
    "2. SSR GET /iletisim rıza yokken Google Maps iframe engelli (placeholder görünür)",
    contactNoConsentRes.ok &&
      contactNoConsentHtml.includes('data-testid="google-map-consent-placeholder"') &&
      !contactNoConsentHtml.includes("maps.google.com/maps"),
    `status=${contactNoConsentRes.status}`,
  );

  // 3. SSR GET / and /iletisim with valid functional consent cookie
  const functionalCookie = makeConsentCookieHeader({
    functional: true,
    analytics: false,
    marketing: false,
  });
  const [homeConsentedRes, contactConsentedRes] = await Promise.all([
    fetch(`${STORE_URL}/`, { headers: { Cookie: functionalCookie } }),
    fetch(`${STORE_URL}/iletisim`, { headers: { Cookie: functionalCookie } }),
  ]);
  const [homeConsentedHtml, contactConsentedHtml] = await Promise.all([
    homeConsentedRes.text(),
    contactConsentedRes.text(),
  ]);
  recordStep(
    "3. SSR geçerli rıza çerezi ile banner gizli ve /iletisim haritası aktif",
    homeConsentedRes.ok &&
      !homeConsentedHtml.includes('data-testid="cookie-consent-banner"') &&
      contactConsentedRes.ok &&
      contactConsentedHtml.includes("maps.google.com/maps"),
    `home=${homeConsentedRes.status}, iletisim=${contactConsentedRes.status}`,
  );

  // 4. SSR malformed consent cookie fails closed
  const corruptRes = await fetch(`${STORE_URL}/iletisim`, {
    headers: { Cookie: `${COOKIE_NAME}=%7Bcorrupt` },
  });
  const corruptHtml = await corruptRes.text();
  recordStep(
    "4. Bozuk rıza çerezi fail-closed çalışır (banner görünür, harita engelli)",
    corruptRes.ok &&
      corruptHtml.includes('data-testid="cookie-consent-banner"') &&
      !corruptHtml.includes("maps.google.com/maps"),
    `status=${corruptRes.status}`,
  );

  // 5-7. Live Playwright browser flows & Axe-core accessibility
  const browser = await launchVerifyBrowser();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Step 5: Reject All persists across reload
    await page.goto(`${STORE_URL}/`, { waitUntil: "networkidle" });
    await page.getByTestId("cookie-consent-banner").waitFor({ state: "visible", timeout: 10000 });
    await page.getByTestId("cookie-reject-all").click();
    await page.getByTestId("cookie-consent-banner").waitFor({ state: "hidden", timeout: 5000 });

    const cookiesAfterReject = await context.cookies();
    const rejectCookie = cookiesAfterReject.find((c) => c.name === COOKIE_NAME);
    const parsedReject = rejectCookie
      ? (JSON.parse(decodeURIComponent(rejectCookie.value)) as Record<string, unknown>)
      : null;

    await page.reload({ waitUntil: "networkidle" });
    const bannerCountAfterReload = await page.getByTestId("cookie-consent-banner").count();

    recordStep(
      "5. Playwright: Tümünü Reddet çerezi kaydeder ve sayfa yenilenince banner görünmez",
      parsedReject?.necessary === true &&
        parsedReject?.functional === false &&
        parsedReject?.analytics === false &&
        parsedReject?.marketing === false &&
        bannerCountAfterReload === 0,
      `cookie=${parsedReject ? JSON.stringify(parsedReject) : "YOK"}, reloadBannerCount=${bannerCountAfterReload}`,
    );

    // Step 6: Footer trigger -> Modal -> Enable functional -> /iletisim map loads
    await page.getByTestId("cookie-preferences-trigger").click();
    await page.getByTestId("cookie-preferences-modal").waitFor({ state: "visible", timeout: 5000 });

    const functionalBefore = await page
      .getByTestId("cookie-toggle-functional")
      .getAttribute("aria-checked");
    const analyticsBefore = await page
      .getByTestId("cookie-toggle-analytics")
      .getAttribute("aria-checked");
    const marketingBefore = await page
      .getByTestId("cookie-toggle-marketing")
      .getAttribute("aria-checked");

    await page.getByTestId("cookie-toggle-functional").click();
    await page.getByTestId("cookie-modal-save").click();
    await page.getByTestId("cookie-preferences-modal").waitFor({ state: "hidden", timeout: 5000 });

    const cookiesAfterSave = await context.cookies();
    const savedCookie = cookiesAfterSave.find((c) => c.name === COOKIE_NAME);
    const parsedSaved = savedCookie
      ? (JSON.parse(decodeURIComponent(savedCookie.value)) as Record<string, unknown>)
      : null;

    await page.goto(`${STORE_URL}/iletisim`, { waitUntil: "networkidle" });
    const mapIframeCount = await page.locator('iframe[src*="maps.google.com/maps"]').count();

    recordStep(
      "6. Playwright: Footer Çerez Tercihleri ile İşlevsel açılır ve /iletisim haritası yüklenir",
      functionalBefore === "false" &&
        analyticsBefore === "false" &&
        marketingBefore === "false" &&
        parsedSaved?.functional === true &&
        parsedSaved?.analytics === false &&
        parsedSaved?.marketing === false &&
        mapIframeCount === 1,
      `before=${functionalBefore}/${analyticsBefore}/${marketingBefore}, mapIframeCount=${mapIframeCount}`,
    );

    await context.close();

    // Step 7: Axe-core on banner & modal + Escape key closes modal
    const a11yContext = await browser.newContext();
    const a11yPage = await a11yContext.newPage();
    await a11yPage.goto(`${STORE_URL}/`, { waitUntil: "networkidle" });
    await a11yPage
      .getByTestId("cookie-consent-banner")
      .waitFor({ state: "visible", timeout: 10000 });

    const bannerAxe = await new AxeBuilder({ page: a11yPage })
      .include('[data-testid="cookie-consent-banner"]')
      .analyze();
    const bannerSerious = bannerAxe.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    await a11yPage.getByTestId("cookie-manage-preferences").click();
    await a11yPage
      .getByTestId("cookie-preferences-modal")
      .waitFor({ state: "visible", timeout: 5000 });

    const modalAxe = await new AxeBuilder({ page: a11yPage })
      .include('[data-testid="cookie-preferences-modal"]')
      .analyze();
    const modalSerious = modalAxe.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    await a11yPage.keyboard.press("Escape");
    await a11yPage
      .getByTestId("cookie-preferences-modal")
      .waitFor({ state: "hidden", timeout: 5000 });
    const modalClosedByEsc = (await a11yPage.getByTestId("cookie-preferences-modal").count()) === 0;

    recordStep(
      "7. Erişilebilirlik (Axe-core WCAG 2.1 AA) + Escape ile modal kapatma",
      bannerSerious.length === 0 && modalSerious.length === 0 && modalClosedByEsc,
      `bannerViolations=${bannerSerious.length}, modalViolations=${modalSerious.length}, escClosed=${modalClosedByEsc}`,
    );

    await a11yContext.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n📊 Özet: ${passed}/${results.length} adım geçti.\n`);
  if (passed !== results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("verify:cookie-consent kritik hata:", err);
  process.exit(1);
});
