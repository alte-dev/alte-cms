import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Browser, Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import {
  launchHeadlessChromium,
  handleLiveServerAbsence,
  resolveMedusaPublishableKey,
} from "./helpers/live-browser";

const BASE_URL = process.env.TEST_WEB_URL || process.env.WEB_PUBLIC_URL || "http://localhost:3100";
const MEDUSA_URL =
  process.env.TEST_MEDUSA_URL || process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";

describe("WCAG 2.1 AA Accessibility Live Audits (Axe-Core on Real Server)", () => {
  let browser: Browser | null = null;
  let isServerAvailable = false;
  let productHandle = "test-urun-sabit-1";
  let blogSlug = "yeni-sezon-hikayesi-ege-esintisi";

  beforeAll(async () => {
    // Check if both live web server and Medusa backend are running
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
        `[A11y Tests] Canlı Web sunucusu (${BASE_URL}) bulunamadı. Offline/CI test ortamı algılandı; tarayıcı başlatılmayacak.`,
      );
      return;
    }
    // Resolve live product handle from Medusa if available (prefer test-urun-sabit-1, exclude COD service item)
    try {
      const pubKey = (await resolveMedusaPublishableKey(MEDUSA_URL)) || "pk_test_alte";
      const pRes = await fetch(`${MEDUSA_URL}/store/products?limit=20`, {
        headers: {
          "x-publishable-api-key": pubKey,
        },
        signal: AbortSignal.timeout(3000),
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        const products: Array<{ handle?: string }> = pData.products || [];
        const preferred =
          products.find((p) => p.handle === "test-urun-sabit-1") ||
          products.find((p) => p.handle && p.handle !== "kapida-odeme-hizmet-bedeli");
        if (preferred?.handle) productHandle = preferred.handle;
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

    browser = await launchHeadlessChromium();
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
    { name: "Müşteri Giriş Sayfası", path: "/hesap/giris" },
    { name: "Müşteri Kayıt Sayfası", path: "/hesap/kayit" },
  ];

  for (const route of routesToAudit) {
    it(`must pass WCAG 2.1 AA audit on live route: ${route.name}`, async (ctx) => {
      if (!isServerAvailable || !browser) {
        handleLiveServerAbsence(
          ctx,
          `Canlı sunucu (${BASE_URL}) çalışmıyor; WCAG denetimi gerçekleştirilemedi.`,
        );
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
