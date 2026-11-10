import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";

describe("WCAG 2.1 AA Accessibility Automated Audits (Axe-Core)", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it("must pass WCAG 2.1 AA audit with zero critical/serious violations on Store Layout shell", async () => {
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    // Emulate realistic store layout shell
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Alte Butik | Mağaza</title>
        </head>
        <body class="bg-stone-50 text-stone-900">
          <a
            href="#main-content"
            class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-stone-900 focus:text-white"
          >
            İçeriğe geç
          </a>

          <header role="banner" class="bg-white border-b border-stone-200">
            <div class="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
              <a href="/" class="text-xl font-bold text-stone-900">Mağaza</a>
              <nav aria-label="Ana Menü">
                <ul class="flex gap-4">
                  <li><a href="/urunler" class="text-stone-700 hover:text-stone-900">Tüm Ürünler</a></li>
                  <li><a href="/blog" class="text-stone-700 hover:text-stone-900">Blog</a></li>
                  <li><a href="/sepet" class="text-stone-700 hover:text-stone-900" aria-label="Sepet (0 ürün)">Sepet (0)</a></li>
                </ul>
              </nav>
            </div>
          </header>

          <main id="main-content" tabindex="-1">
            <section class="max-w-7xl mx-auto px-4 py-8">
              <h1 class="text-3xl font-bold text-stone-900 mb-4">Yeni Sezon Ürünleri</h1>
              <p class="text-stone-600 mb-6">Özenle seçilmiş kaliteli parçalar.</p>
              <div class="grid grid-cols-2 gap-4">
                <article class="border rounded p-4 bg-white">
                  <h2 class="text-lg font-semibold text-stone-900">İpek Elbise</h2>
                  <p class="text-stone-700">1.250 TL</p>
                  <a href="/urun/ipek-elbise" class="inline-block mt-2 text-stone-900 font-medium underline">Ürünü İncele</a>
                </article>
              </div>
            </section>
          </main>

          <footer role="contentinfo" class="bg-stone-900 text-stone-300 py-8 mt-12">
            <div class="max-w-7xl mx-auto px-4">
              <p class="text-sm">&copy; 2026 Mağaza. Tüm hakları saklıdır. Fiyatlarımıza KDV dahildir.</p>
            </div>
          </footer>
        </body>
      </html>
    `);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    expect(criticalOrSerious).toEqual([]);
    await context.close();
  });

  it("must pass WCAG 2.1 AA audit with zero critical/serious violations on Checkout Form", async () => {
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    // Emulate Checkout form shell
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="utf-8" />
          <title>Ödeme | Mağaza</title>
        </head>
        <body class="bg-stone-50 text-stone-900">
          <main id="main-content">
            <h1>Siparişi Tamamla</h1>
            <form action="/api/checkout" method="POST">
              <fieldset>
                <legend>İletişim Bilgileri</legend>
                <div>
                  <label for="checkout-email">E-posta Adresi</label>
                  <input id="checkout-email" name="email" type="email" required />
                </div>
                <div>
                  <label for="checkout-phone">Cep Telefonu</label>
                  <input id="checkout-phone" name="phone" type="tel" required />
                </div>
              </fieldset>

              <fieldset>
                <legend>Teslimat Adresi</legend>
                <div>
                  <label for="checkout-first-name">Ad</label>
                  <input id="checkout-first-name" name="firstName" type="text" required />
                </div>
                <div>
                  <label for="checkout-last-name">Soyad</label>
                  <input id="checkout-last-name" name="lastName" type="text" required />
                </div>
                <div>
                  <label for="checkout-city">Şehir</label>
                  <select id="checkout-city" name="city">
                    <option value="İstanbul">İstanbul</option>
                    <option value="Ankara">Ankara</option>
                  </select>
                </div>
                <div>
                  <label for="checkout-address">Açık Adres</label>
                  <textarea id="checkout-address" name="address" required></textarea>
                </div>
              </fieldset>

              <fieldset>
                <legend>Yasal Onaylar</legend>
                <div>
                  <input id="consent-contract" name="contract" type="checkbox" required />
                  <label for="consent-contract">Mesafeli Satış Sözleşmesi'ni okudum, onaylıyorum.</label>
                </div>
                <div>
                  <input id="consent-kvkk" name="kvkk" type="checkbox" required />
                  <label for="consent-kvkk">KVKK Aydınlatma Metni'ni okudum, onaylıyorum.</label>
                </div>
              </fieldset>

              <div role="alert" aria-live="polite" id="checkout-error" style="display:none;"></div>

              <button type="submit">Siparişi Onayla</button>
            </form>
          </main>
        </body>
      </html>
    `);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    expect(criticalOrSerious).toEqual([]);
    await context.close();
  });
});
