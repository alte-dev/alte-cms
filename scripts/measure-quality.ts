import fs from "fs";
import path from "path";
import zlib from "zlib";
import { chromium } from "playwright";

interface MetricRow {
  pageName: string;
  urlPath: string;
  performance: string;
  accessibility: string;
  bestPractices: string;
  seo: string;
  lcp: string;
  cls: string;
  tbt: string;
  firstLoadJs: string;
}

const BASE_URL = process.env.WEB_PUBLIC_URL || "http://localhost:3100";
const NUM_RUNS = 3;

const TARGET_PAGES: Array<{ name: string; path: string; appRoute: string }> = [
  { name: "Anasayfa", path: "/", appRoute: "/(store)/page" },
  { name: "Tüm Ürünler", path: "/urunler", appRoute: "/(store)/urunler/page" },
  { name: "Ürün Detayı", path: "/urun/ornek-urun", appRoute: "/(store)/urun/[handle]/page" },
  { name: "Sepet", path: "/sepet", appRoute: "/(store)/sepet/page" },
  { name: "Blog Listesi", path: "/blog", appRoute: "/(store)/blog/page" },
  { name: "Blog Detayı", path: "/blog/ornek-yazi", appRoute: "/(store)/blog/[slug]/page" },
  { name: "Puck Sayfası", path: "/sayfa/hakkimizda", appRoute: "/(store)/sayfa/[...slug]/page" },
];

function getFirstLoadJsGzip(appRoute: string): string {
  try {
    const manifestPath = path.resolve(process.cwd(), "apps/web/.next/app-build-manifest.json");
    if (!fs.existsSync(manifestPath)) return "ölçülmedi";

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const files = manifest.pages[appRoute] || [];
    if (!files || files.length === 0) return "ölçülmedi";

    const baseDir = path.resolve(process.cwd(), "apps/web/.next");
    const uniqueFiles = new Set<string>(files);
    let totalBytes = 0;

    for (const f of uniqueFiles) {
      const fullPath = path.join(baseDir, f);
      if (fs.existsSync(fullPath)) {
        totalBytes += zlib.gzipSync(fs.readFileSync(fullPath)).length;
      }
    }

    return `${(totalBytes / 1024).toFixed(1)} kB`;
  } catch {
    return "ölçülmedi";
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function isServerRunning(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function measurePageWithLighthouse(
  url: string,
  port: number,
  lighthouseFn: any,
): Promise<{
  perf: number;
  a11y: number;
  bp: number;
  seo: number;
  lcp: number;
  cls: number;
  tbt: number;
} | null> {
  try {
    const runnerResult = await lighthouseFn(url, {
      port,
      output: "json",
      logLevel: "error",
      formFactor: "mobile",
      screenEmulation: {
        mobile: true,
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        disabled: false,
      },
      throttlingMethod: "simulate",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });

    if (!runnerResult?.lhr) return null;
    const { categories, audits } = runnerResult.lhr;

    return {
      perf: Math.round((categories.performance?.score || 0) * 100),
      a11y: Math.round((categories.accessibility?.score || 0) * 100),
      bp: Math.round((categories["best-practices"]?.score || 0) * 100),
      seo: Math.round((categories.seo?.score || 0) * 100),
      lcp: Math.round(audits["largest-contentful-paint"]?.numericValue || 0),
      cls: Number((audits["cumulative-layout-shift"]?.numericValue || 0).toFixed(3)),
      tbt: Math.round(audits["total-blocking-time"]?.numericValue || 0),
    };
  } catch (err) {
    console.warn(`Lighthouse measurement failed for ${url}:`, (err as Error).message);
    return null;
  }
}

async function main() {
  console.log("=== FAZ 11A: Lighthouse Mobil Kalite ve Metrik Ölçüm Başlangıcı ===");
  const isUp = await isServerRunning(BASE_URL);

  const results: MetricRow[] = [];
  let browser: any = null;
  let lighthouseFn: any = null;
  const REMOTE_PORT = 9222;

  if (isUp) {
    console.log(`Sunucu aktif: ${BASE_URL}. Playwright Chromium ve Lighthouse başlatılıyor...`);
    try {
      lighthouseFn = (await import("lighthouse")).default;
      browser = await chromium.launch({
        args: [`--remote-debugging-port=${REMOTE_PORT}`],
        headless: true,
      });
    } catch (e) {
      console.warn("Tarayıcı veya Lighthouse başlatılamadı:", (e as Error).message);
    }
  } else {
    console.log(
      `Sunucu erişilebilir değil (${BASE_URL}). Lighthouse skorları "ölçülmedi" olarak kaydedilecek.`,
    );
  }

  for (const page of TARGET_PAGES) {
    const fullUrl = `${BASE_URL}${page.path}`;
    const firstLoadJs = getFirstLoadJsGzip(page.appRoute);

    if (browser && lighthouseFn) {
      console.log(`Ölçülüyor (3 tekrar): ${page.name} (${fullUrl})...`);
      const perfScores: number[] = [];
      const a11yScores: number[] = [];
      const bpScores: number[] = [];
      const seoScores: number[] = [];
      const lcpScores: number[] = [];
      const clsScores: number[] = [];
      const tbtScores: number[] = [];

      for (let run = 1; run <= NUM_RUNS; run++) {
        process.stdout.write(`  Çalıştırma ${run}/${NUM_RUNS}... `);
        const data = await measurePageWithLighthouse(fullUrl, REMOTE_PORT, lighthouseFn);
        if (data) {
          perfScores.push(data.perf);
          a11yScores.push(data.a11y);
          bpScores.push(data.bp);
          seoScores.push(data.seo);
          lcpScores.push(data.lcp);
          clsScores.push(data.cls);
          tbtScores.push(data.tbt);
          console.log(`OK (P:${data.perf} A:${data.a11y} S:${data.seo})`);
        } else {
          console.log("FAIL");
        }
      }

      if (perfScores.length > 0) {
        results.push({
          pageName: page.name,
          urlPath: page.path,
          performance: `${Math.round(median(perfScores))}`,
          accessibility: `${Math.round(median(a11yScores))}`,
          bestPractices: `${Math.round(median(bpScores))}`,
          seo: `${Math.round(median(seoScores))}`,
          lcp: `${Math.round(median(lcpScores))} ms`,
          cls: `${median(clsScores).toFixed(3)}`,
          tbt: `${Math.round(median(tbtScores))} ms`,
          firstLoadJs,
        });
      } else {
        results.push({
          pageName: page.name,
          urlPath: page.path,
          performance: "ölçülmedi",
          accessibility: "ölçülmedi",
          bestPractices: "ölçülmedi",
          seo: "ölçülmedi",
          lcp: "ölçülmedi",
          cls: "ölçülmedi",
          tbt: "ölçülmedi",
          firstLoadJs,
        });
      }
    } else {
      results.push({
        pageName: page.name,
        urlPath: page.path,
        performance: "ölçülmedi",
        accessibility: "ölçülmedi",
        bestPractices: "ölçülmedi",
        seo: "ölçülmedi",
        lcp: "ölçülmedi",
        cls: "ölçülmedi",
        tbt: "ölçülmedi",
        firstLoadJs,
      });
    }
  }

  if (browser) {
    await browser.close();
  }

  // Generate docs/QUALITY-BASELINE.md content
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
  let mdContent = `# Kalite ve Performans Temel Ölçüm Raporu (docs/QUALITY-BASELINE.md)\n\n`;
  mdContent += `Bu dosya \`scripts/measure-quality.ts\` tarafından otomatik olarak üretilmiştir. Sayılar elle yazılmaz.\n`;
  mdContent += `Tarih: ${nowStr} (UTC)\n\n`;
  mdContent += `### Mobil Profil Lighthouse ve First Load JS Ölçümleri (3 Çalıştırma Medyanı)\n\n`;
  mdContent += `| Sayfa | URL | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT | First Load JS (Gzip) |\n`;
  mdContent += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  for (const r of results) {
    mdContent += `| ${r.pageName} | \`${r.urlPath}\` | ${r.performance} | ${r.accessibility} | ${r.bestPractices} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} | ${r.firstLoadJs} |\n`;
  }

  mdContent += `\n### Hedefler ve Değerlendirme\n\n`;
  mdContent += `- **Accessibility:** Hedef ≥ 95 (WCAG 2.1 AA uyumu).\n`;
  mdContent += `- **SEO:** Hedef ≥ 95 (Yapılandırılmış veri, meta etiketler, robots/sitemap).\n`;
  mdContent += `- **CLS:** Hedef < 0.1 (Kayıpsız görsel rezervasyonları ve stabil düzen).\n`;
  mdContent += `- **First Load JS:** Hedef ~110 kB (Puck editör kodu public paketlere dahil edilmez).\n`;

  const outPath = path.resolve(process.cwd(), "docs/QUALITY-BASELINE.md");
  fs.writeFileSync(outPath, mdContent, "utf8");
  console.log(`\nBaşarıyla güncellendi: ${outPath}`);
}

main().catch((err) => {
  console.error("Ölçüm betiği kritik hata:", err);
  process.exit(1);
});
