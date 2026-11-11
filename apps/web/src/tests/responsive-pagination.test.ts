import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser, Page } from "playwright";
import { launchHeadlessChromium, handleLiveServerAbsence } from "./helpers/live-browser";

const BASE_URL = process.env.TEST_WEB_URL || process.env.WEB_PUBLIC_URL || "http://localhost:3100";

describe("Responsive Pagination & Mobile Overflow Prevention", () => {
  let browser: Browser | null = null;
  let isServerAvailable = false;

  beforeAll(async () => {
    try {
      const probeRes = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(5000) });
      isServerAvailable = probeRes.status === 200;
    } catch {
      isServerAvailable = false;
    }

    if (!isServerAvailable) {
      console.warn(
        `[Pagination Test] Canlı Web sunucusu (${BASE_URL}) bulunamadı. Offline/CI test ortamı algılandı; tarayıcı başlatılmayacak.`,
      );
      return;
    }

    browser = await launchHeadlessChromium();
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  function ensureBrowserOrSkip(ctx: { skip: () => void }): Browser {
    if (!isServerAvailable || !browser) {
      handleLiveServerAbsence(
        ctx,
        `[Pagination Test] Canlı Web sunucusu (${BASE_URL}) erişilemez durumda! REQUIRE_LIVE_SERVER=true iken test atlanamaz.`,
      );
    }
    return browser!;
  }

  it("must prevent horizontal page overflow on mobile viewport (375x667)", async (ctx) => {
    const activeBrowser = ensureBrowserOrSkip(ctx);

    const context = await activeBrowser.newContext({
      viewport: { width: 375, height: 667 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
    });
    const page: Page = await context.newPage();

    await page.goto(`${BASE_URL}/urunler`, { waitUntil: "domcontentloaded", timeout: 10000 });

    // Measure document overflow
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        clientWidth: doc.clientWidth,
        scrollWidth: doc.scrollWidth,
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth,
      };
    });

    expect(overflow.hasHorizontalOverflow).toBe(false);
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);

    await context.close();
  }, 15000);

  it("must render sliding window pagination buttons on desktop without overflowing", async (ctx) => {
    const activeBrowser = ensureBrowserOrSkip(ctx);

    const context = await activeBrowser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page: Page = await context.newPage();

    await page.goto(`${BASE_URL}/urunler`, { waitUntil: "domcontentloaded", timeout: 10000 });

    const paginationNav = page.locator("nav[aria-label='Sayfalama']");
    const count = await paginationNav.count();

    if (count > 0) {
      // Check that pagination buttons do not exceed reasonable window size (<= 9 items)
      const pageLinks = paginationNav.locator("a[aria-label*='Sayfa']");
      const totalRenderedLinks = await pageLinks.count();
      expect(totalRenderedLinks).toBeLessThanOrEqual(7);

      // Verify page does not have horizontal overflow on desktop
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBe(false);
    }

    await context.close();
  }, 15000);
});
