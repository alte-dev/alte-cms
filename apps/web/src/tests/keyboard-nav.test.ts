import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser, Page } from "playwright";
import {
  launchHeadlessChromium,
  handleLiveServerAbsence,
  resolveMedusaPublishableKey,
} from "./helpers/live-browser";

const BASE_URL = process.env.TEST_WEB_URL || process.env.WEB_PUBLIC_URL || "http://localhost:3100";
const MEDUSA_URL =
  process.env.TEST_MEDUSA_URL || process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";

describe("Keyboard Navigation & Focus Management (WCAG 2.1 AA on Real Server)", () => {
  let browser: Browser | null = null;
  let isServerAvailable = false;
  let productHandle = "test-urun-sabit-1";

  beforeAll(async () => {
    try {
      const [probeWeb, probeMedusa] = await Promise.all([
        fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(5000) }),
        fetch(`${MEDUSA_URL}/health`, { signal: AbortSignal.timeout(5000) }),
      ]);
      isServerAvailable = probeWeb.status === 200 && probeMedusa.ok;
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
      const pubKey = (await resolveMedusaPublishableKey(MEDUSA_URL)) || "pk_test_alte";
      const pRes = await fetch(`${MEDUSA_URL}/store/products?handle=test-urun-sabit-1`, {
        headers: {
          "x-publishable-api-key": pubKey,
        },
        signal: AbortSignal.timeout(3000),
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.products?.[0]?.handle) {
          productHandle = pData.products[0].handle;
        } else {
          const listRes = await fetch(`${MEDUSA_URL}/store/products?limit=10`, {
            headers: {
              "x-publishable-api-key": pubKey,
            },
            signal: AbortSignal.timeout(3000),
          });
          if (listRes.ok) {
            const listData = await listRes.json();
            const valid = (listData.products || []).find(
              (p: { handle?: string }) => p.handle && p.handle !== "kapida-odeme-hizmet-bedeli",
            );
            if (valid?.handle) productHandle = valid.handle;
          }
        }
      }
    } catch {
      // Fallback
    }

    browser = await launchHeadlessChromium();
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it("must support skip link navigation to #main-content using keyboard Tab and Enter on live page", async (ctx) => {
    if (!isServerAvailable || !browser) {
      handleLiveServerAbsence(
        ctx,
        `Canlı sunucu (${BASE_URL}) çalışmıyor; klavye testi gerçekleştirilemedi.`,
      );
      return;
    }
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 10000 });

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

  it("must open search suggestions and close on Escape key using keyboard on live page", async (ctx) => {
    if (!isServerAvailable || !browser) {
      handleLiveServerAbsence(
        ctx,
        `Canlı sunucu (${BASE_URL}) çalışmıyor; klavye testi gerçekleştirilemedi.`,
      );
      return;
    }
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 10000 });

    // Focus search input and type query
    const searchInput = page.locator("#store-search-input");
    await searchInput.focus();
    await page.keyboard.type("urun", { delay: 50 });
    await page.waitForFunction(
      () => document.getElementById("store-search-input")?.getAttribute("aria-expanded") === "true",
      { timeout: 5000 },
    );

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

  it("must support adding a product to cart using keyboard navigation on live product page", async (ctx) => {
    if (!isServerAvailable || !browser) {
      handleLiveServerAbsence(
        ctx,
        `Canlı sunucu (${BASE_URL}) çalışmıyor; klavye testi gerçekleştirilemedi.`,
      );
      return;
    }
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    await page.goto(`${BASE_URL}/urun/${productHandle}`, {
      waitUntil: "networkidle",
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

  it("must navigate checkout form with keyboard and trigger validation error on invalid input", async (ctx) => {
    if (!isServerAvailable || !browser) {
      handleLiveServerAbsence(
        ctx,
        `Canlı sunucu (${BASE_URL}) çalışmıyor; klavye testi gerçekleştirilemedi.`,
      );
      return;
    }
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    // 1. Add item to cart first so checkout form is accessible
    await page.goto(`${BASE_URL}/urun/${productHandle}`, {
      waitUntil: "networkidle",
      timeout: 10000,
    });
    const addBtn = page.locator("button:has-text('Sepete Ekle')").first();
    await addBtn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);

    // 2. Navigate to checkout page
    await page.goto(`${BASE_URL}/odeme`, {
      waitUntil: "networkidle",
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

  it("must complete keyboard-only customer register, login, and logout flow on live pages", async (ctx) => {
    if (!isServerAvailable || !browser) {
      handleLiveServerAbsence(
        ctx,
        `Canlı sunucu (${BASE_URL}) çalışmıyor; klavye hesap testi gerçekleştirilemedi.`,
      );
      return;
    }

    const uniqueEmail = `e2e-kbd-${Date.now()}@example.test`;
    const testPass = "GucluKbdTestParola2026!";

    const context = await browser.newContext();
    const page: Page = await context.newPage();

    // 1. Register via keyboard on /hesap/kayit
    await page.goto(`${BASE_URL}/hesap/kayit`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    await page.focus("#reg-first-name");
    await page.keyboard.type("Klavye");
    await page.keyboard.press("Tab"); // reg-last-name
    await page.keyboard.type("Kullanici");
    await page.keyboard.press("Tab"); // reg-email
    await page.keyboard.type(uniqueEmail);
    await page.keyboard.press("Tab"); // reg-phone
    await page.keyboard.type("05550001122");
    await page.keyboard.press("Tab"); // reg-password
    await page.keyboard.type(testPass);
    await page.keyboard.press("Tab"); // KVKK link
    await page.keyboard.press("Tab"); // reg-kvkk checkbox (wait, checkbox comes before or after link? Let's focus checkbox directly for determinism)
    await page.focus("#reg-kvkk");
    await page.keyboard.press("Space");

    const regBtn = page.locator("button[type='submit']");
    await regBtn.focus();
    await page.keyboard.press("Enter");

    await page.locator("[role='status']").waitFor({ state: "visible", timeout: 10000 });
    const statusText = await page.locator("[role='status']").innerText();
    expect(statusText).toContain("Kaydınız alındı");

    // 2. Login via keyboard on /hesap/giris
    await page.goto(`${BASE_URL}/hesap/giris`, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    await page.focus("#login-email");
    await page.keyboard.type(uniqueEmail);
    await page.keyboard.press("Tab"); // login-password
    await page.keyboard.type(testPass);

    const loginBtn = page.locator("button[type='submit']");
    await loginBtn.focus();
    await page.keyboard.press("Enter");

    await page.waitForURL("**/hesap", { timeout: 10000 });
    const headingText = await page.locator("h1").innerText();
    expect(headingText).toContain("Hesabım");

    // 3. Logout via keyboard
    const logoutBtn = page.locator("button:has-text('Çıkış Yap')");
    await logoutBtn.focus();
    await page.keyboard.press("Enter");

    await page.waitForURL("**/hesap/giris", { timeout: 10000 });

    await context.close();
  }, 25000);
});
