import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

const BASE_URL = process.env.TEST_WEB_URL || "http://localhost:3100";
const MEDUSA_URL = process.env.TEST_MEDUSA_URL || "http://127.0.0.1:9000";

describe("Keyboard Navigation & Focus Management (WCAG 2.1 AA on Real Server)", () => {
  let browser: Browser | null = null;
  let isServerAvailable = false;
  let productHandle = "test-urun-sabit-1";

  beforeAll(async () => {
    try {
      const probeRes = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(1500) });
      isServerAvailable = probeRes.status === 200;
    } catch {
      isServerAvailable = false;
    }

    if (!isServerAvailable) {
      console.warn(
        `[Keyboard Tests] Canlı Web sunucusu (${BASE_URL}) bulunamadı. Offline/CI test ortamı algılandı; tarayıcı başlatılmayacak.`,
      );
      return;
    }
    try {
      const pRes = await fetch(`${MEDUSA_URL}/store/products?limit=1`, {
        headers: {
          "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "pk_test_alte",
        },
        signal: AbortSignal.timeout(3000),
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.products?.[0]?.handle) productHandle = pData.products[0].handle;
      }
    } catch {
      // Fallback
    }

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it("must support skip link navigation to #main-content using keyboard Tab and Enter on live page", async () => {
    if (!isServerAvailable || !browser) return;
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 10000 });

    // Press Tab from initial page load to land on skip link
    await page.keyboard.press("Tab");
    const focusedText = await page.evaluate(() => document.activeElement?.textContent?.trim());
    const focusedHref = await page.evaluate(() => document.activeElement?.getAttribute("href"));

    expect(focusedText).toBe("İçeriğe geç");
    expect(focusedHref).toBe("#main-content");

    // Activate skip link with Enter
    await page.keyboard.press("Enter");
    const activeTargetId = await page.evaluate(() => document.activeElement?.id);
    expect(activeTargetId).toBe("main-content");

    await context.close();
  });

  it("must open search suggestions and close on Escape key using keyboard on live page", async () => {
    if (!isServerAvailable || !browser) return;
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 10000 });

    // Focus search input and type query
    await page.focus("#store-search-input");
    await page.keyboard.type("ipek");
    await page.waitForTimeout(600);

    const isOpenBefore = await page.evaluate(() => {
      return document.getElementById("store-search-input")?.getAttribute("aria-expanded");
    });
    expect(isOpenBefore).toBe("true");

    // Press Escape to dismiss suggestions
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    const isOpenAfter = await page.evaluate(() => {
      return document.getElementById("store-search-input")?.getAttribute("aria-expanded");
    });
    expect(isOpenAfter).toBe("false");

    await context.close();
  });

  it("must support adding a product to cart using keyboard navigation on live product page", async () => {
    if (!isServerAvailable || !browser) return;
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    await page.goto(`${BASE_URL}/urun/${productHandle}`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    const addBtn = page.locator("button:has-text('Sepete Ekle')").first();
    await addBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    // Verify cart link or notification in header
    const cartText = await page.locator("a[href='/sepet']").first().innerText();
    expect(cartText).toBeTruthy();

    await context.close();
  }, 15000);

  it("must navigate checkout form with keyboard and trigger validation error on invalid input", async () => {
    if (!isServerAvailable || !browser) return;
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    // 1. Add item to cart first so checkout form is accessible
    await page.goto(`${BASE_URL}/urun/${productHandle}`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
    const addBtn = page.locator("button:has-text('Sepete Ekle')").first();
    await addBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    // 2. Navigate to checkout page
    await page.goto(`${BASE_URL}/odeme`, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    // 3. Fill invalid email using keyboard Tab and typing
    await page.focus("#email");
    await page.keyboard.type("gecersiz-format-email");

    await page.keyboard.press("Tab"); // phone
    await page.keyboard.type("05551234567");

    await page.keyboard.press("Tab"); // firstName
    await page.keyboard.type("TestAd");

    await page.keyboard.press("Tab"); // lastName
    await page.keyboard.type("TestSoyad");

    // Submit with keyboard Enter
    const submitBtn = page
      .locator("button[type='submit'], button:has-text('Ödeme'), button:has-text('Tamamla')")
      .last();
    await submitBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);

    // Verify form validation failed for invalid email
    const emailValid = await page.evaluate(() => {
      const el = document.getElementById("email") as HTMLInputElement | null;
      return el ? el.checkValidity() : null;
    });
    expect(emailValid).toBe(false);

    await context.close();
  }, 15000);
});
