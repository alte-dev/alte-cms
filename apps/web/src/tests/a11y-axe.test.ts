import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.TEST_WEB_URL || "http://localhost:3100";
const MEDUSA_URL = process.env.TEST_MEDUSA_URL || "http://127.0.0.1:9000";

describe("WCAG 2.1 AA Accessibility Live Audits (Axe-Core on Real Server)", () => {
  let browser: Browser | null = null;
  let isServerAvailable = false;
  let productHandle = "test-urun-sabit-1";
  let blogSlug = "yeni-sezon-hikayesi-ege-esintisi";

  beforeAll(async () => {
    // Check if live web server is running
    try {
      const probeRes = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(1500) });
      isServerAvailable = probeRes.status === 200;
    } catch {
      isServerAvailable = false;
    }

    if (!isServerAvailable) {
      console.warn(
        `[A11y Tests] Canlı Web sunucusu (${BASE_URL}) bulunamadı. Offline/CI test ortamı algılandı; tarayıcı başlatılmayacak.`,
      );
      return;
    }
    // Resolve live product handle from Medusa if available
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
      // Fallback to default seeded test product
    }

    // Resolve live blog post slug from Payload if available
    try {
      const bRes = await fetch(`${BASE_URL}/api/posts?limit=1`, {
        signal: AbortSignal.timeout(3000),
      });
      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData.docs?.[0]?.slug) blogSlug = bData.docs[0].slug;
      }
    } catch {
      // Fallback to default seeded test blog post
    }

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  const routesToAudit = [
    { name: "Ana Sayfa", path: "/" },
    { name: "Ürünler Kataloğu", path: "/urunler" },
    { name: "Ürün Detayı", getPath: () => `/urun/${productHandle}` },
    { name: "Sepet Sayfası", path: "/sepet" },
    { name: "Ödeme / Checkout", path: "/odeme" },
    { name: "Blog Listesi", path: "/blog" },
    { name: "Blog Yazısı", getPath: () => `/blog/${blogSlug}` },
    { name: "Puck Sayfası (Hakkımızda)", path: "/sayfa/hakkimizda" },
  ];

  for (const route of routesToAudit) {
    it(`must pass WCAG 2.1 AA audit on live route: ${route.name}`, async () => {
      if (!isServerAvailable || !browser) {
        return;
      }
      const targetPath = route.getPath ? route.getPath() : route.path!;
      const context = await browser.newContext();
      const page: Page = await context.newPage();

      const response = await page.goto(`${BASE_URL}${targetPath}`, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });

      expect(response?.status()).toBe(200);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const criticalOrSerious = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );

      expect(criticalOrSerious).toEqual([]);
      await context.close();
    }, 15000);
  }
});
