import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";

describe("Keyboard Navigation & Focus Management (WCAG 2.1 AA)", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
  });

  it("must support skip link navigation to main content using keyboard Tab and Enter", async () => {
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html lang="tr">
        <head><title>Skip Link Test</title></head>
        <body>
          <a id="skip-link" href="#main-content" style="position: absolute; top: -100px;">İçeriğe geç</a>
          <header><a href="/">Logo</a></header>
          <main id="main-content" tabindex="-1">
            <h1>Ana İçerik Başlığı</h1>
          </main>
        </body>
      </html>
    `);

    // Press Tab from address bar to land on skip link
    await page.keyboard.press("Tab");
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe("skip-link");

    // Activate skip link with Enter
    await page.keyboard.press("Enter");
    const activeTargetId = await page.evaluate(() => document.activeElement?.id);
    expect(activeTargetId).toBe("main-content");

    await context.close();
  });

  it("must support keyboard selection and adding to cart without mouse", async () => {
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html lang="tr">
        <head><title>Add To Cart Keyboard</title></head>
        <body>
          <main>
            <div id="options-group">
              <button id="opt-s" type="button" aria-pressed="true">S</button>
              <button id="opt-m" type="button" aria-pressed="false">M</button>
            </div>
            <button id="qty-plus" type="button" aria-label="Adeti Artır">+</button>
            <button id="add-btn" type="button">Sepete Ekle</button>
            <div id="status-msg" role="status" aria-live="polite"></div>
          </main>
          <script>
            document.getElementById('add-btn').addEventListener('click', () => {
              document.getElementById('status-msg').innerText = 'Ürün sepete başarıyla eklendi!';
            });
          </script>
        </body>
      </html>
    `);

    // Tab through buttons
    await page.keyboard.press("Tab"); // opt-s
    await page.keyboard.press("Tab"); // opt-m
    await page.keyboard.press("Tab"); // qty-plus
    await page.keyboard.press("Tab"); // add-btn

    const activeId = await page.evaluate(() => document.activeElement?.id);
    expect(activeId).toBe("add-btn");

    // Press Enter to submit
    await page.keyboard.press("Enter");
    const msg = await page.locator("#status-msg").innerText();
    expect(msg).toBe("Ürün sepete başarıyla eklendi!");

    await context.close();
  });

  it("must close search suggestions popup on Escape key", async () => {
    const context = await browser.newContext();
    const page: Page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html lang="tr">
        <head><title>Search Esc Test</title></head>
        <body>
          <input id="search-input" type="search" placeholder="Ara..." />
          <div id="suggestions" style="display: block;">Sonuçlar</div>
          <script>
            document.getElementById('search-input').addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                document.getElementById('suggestions').style.display = 'none';
              }
            });
          </script>
        </body>
      </html>
    `);

    await page.focus("#search-input");
    await page.keyboard.press("Escape");

    const display = await page.evaluate(
      () => (document.getElementById("suggestions") as HTMLElement).style.display,
    );
    expect(display).toBe("none");

    await context.close();
  });
});
