import fs from "fs";
import path from "path";
import zlib from "zlib";
import { execSync } from "child_process";
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
const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";
const NUM_RUNS = 3;

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
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function resolveDynamicTargetPages(): Promise<
  Array<{ name: string; path: string; appRoute: string }>
> {
  const pubKey =
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    process.env.MEDUSA_PUBLISHABLE_KEY ||
    "pk_d7276af353492091a49cbd91c3ed5105f3943e9bac06ff9fb4b5dd6560b3d139";

  let productHandle = "test-urun-sabit-1";
  try {
    const medusaRes = await fetch(`${MEDUSA_URL}/store/products?limit=1`, {
      headers: { "x-publishable-api-key": pubKey },
    });
    if (medusaRes.ok) {
      const data = await medusaRes.json();
      if (data.products?.[0]?.handle) {
        productHandle = data.products[0].handle;
      }
    }
  } catch {
    // fallback to default seeded handle
  }

  let blogSlug = "kapsul-gardrop-olusturmanin-5-altin-kurali";
  try {
    const payloadRes = await fetch(
      `${BASE_URL}/api/posts?limit=1&where[_status][equals]=published`,
    );
    if (payloadRes.ok) {
      const data = await payloadRes.json();
      if (data.docs?.[0]?.slug) {
        blogSlug = data.docs[0].slug;
      }
    }
  } catch {
    // fallback
  }

  return [
    { name: "Anasayfa", path: "/", appRoute: "/(store)/page" },
    { name: "Tüm Ürünler", path: "/urunler", appRoute: "/(store)/urunler/page" },
    {
      name: "Ürün Detayı",
      path: `/urun/${productHandle}`,
      appRoute: "/(store)/urun/[handle]/page",
    },
    { name: "Sepet", path: "/sepet", appRoute: "/(store)/sepet/page" },
    { name: "Blog Listesi", path: "/blog", appRoute: "/(store)/blog/page" },
    { name: "Blog Detayı", path: `/blog/${blogSlug}`, appRoute: "/(store)/blog/[slug]/page" },
    { name: "Puck Sayfası", path: "/sayfa/hakkimizda", appRoute: "/(store)/sayfa/[slug]/page" },
  ];
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

function getProcessMemoryWorkingSetMb(port: number): number | null {
  try {
    const output = execSync(
      `powershell -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { (Get-Process -Id $_.OwningProcess).WorkingSet64 / 1MB }"`,
      { encoding: "utf8" },
    ).trim();
    const val = parseFloat(output);
    return isNaN(val) ? null : Math.round(val * 10) / 10;
  } catch {
    return null;
  }
}

async function main() {
  console.log("=== FAZ 11A: Lighthouse Mobil Kalite ve Metrik Ölçüm Başlangıcı ===");
  const isUp = await isServerRunning(BASE_URL);

  if (!isUp) {
    console.error(
      `❌ Kritik Hata: Web sunucusuna (${BASE_URL}) erişilemiyor. Önce sunucuyu başlatın.`,
    );
    process.exit(1);
  }

  const targetPages = await resolveDynamicTargetPages();
  console.log(`Dinamik hedef sayfalar çözümlendi (${targetPages.length} sayfa).`);

  const results: MetricRow[] = [];
  let browser: any = null;
  let lighthouseFn: any = null;
  const REMOTE_PORT = 9222;

  const chromePath = process.env.CHROME_PATH || chromium.executablePath();
  console.log(`Tarayıcı yürütülebilir yolu: ${chromePath}`);

  try {
    lighthouseFn = (await import("lighthouse")).default;
    browser = await chromium.launch({
      executablePath: chromePath,
      args: [`--remote-debugging-port=${REMOTE_PORT}`, "--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
  } catch (e) {
    console.error("❌ Kritik Hata: Tarayıcı veya Lighthouse başlatılamadı:", (e as Error).message);
    process.exit(1);
  }

  for (const page of targetPages) {
    const fullUrl = `${BASE_URL}${page.path}`;
    const firstLoadJs = getFirstLoadJsGzip(page.appRoute);

    // Pre-flight check: page must return HTTP 200 to be measured
    let checkStatus = 0;
    try {
      const probe = await fetch(fullUrl, { signal: AbortSignal.timeout(4000) });
      checkStatus = probe.status;
    } catch {
      checkStatus = 0;
    }

    if (checkStatus !== 200) {
      console.warn(
        `Sayfa HTTP 200 dönmüyor (${checkStatus}): ${fullUrl}. Ölçülmedi olarak kaydediliyor.`,
      );
      results.push({
        pageName: page.name,
        urlPath: page.path,
        performance: `ölçülmedi: HTTP ${checkStatus}`,
        accessibility: `ölçülmedi: HTTP ${checkStatus}`,
        bestPractices: `ölçülmedi: HTTP ${checkStatus}`,
        seo: `ölçülmedi: HTTP ${checkStatus}`,
        lcp: `ölçülmedi: HTTP ${checkStatus}`,
        cls: `ölçülmedi: HTTP ${checkStatus}`,
        tbt: `ölçülmedi: HTTP ${checkStatus}`,
        firstLoadJs,
      });
      continue;
    }

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
        console.log(
          `OK (P:${data.perf} A:${data.a11y} BP:${data.bp} S:${data.seo} LCP:${data.lcp}ms CLS:${data.cls})`,
        );
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
        performance: "ölçülmedi: Lighthouse hatası",
        accessibility: "ölçülmedi: Lighthouse hatası",
        bestPractices: "ölçülmedi: Lighthouse hatası",
        seo: "ölçülmedi: Lighthouse hatası",
        lcp: "ölçülmedi: Lighthouse hatası",
        cls: "ölçülmedi: Lighthouse hatası",
        tbt: "ölçülmedi: Lighthouse hatası",
        firstLoadJs,
      });
    }
  }

  if (browser) {
    await browser.close();
  }

  // Measure Real RSS Memory under load
  const medusaRss = getProcessMemoryWorkingSetMb(9000);
  const webRss = getProcessMemoryWorkingSetMb(3100);

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

  mdContent += `\n### Gerçek Bellek Ölçümü (Yük Altında RSS / Working Set)\n\n`;
  mdContent += `| Servis | Port | Ölçülen RSS | Bütçe | Durum |\n`;
  mdContent += `| :--- | :---: | :---: | :---: | :---: |\n`;
  mdContent += `| Medusa v2 | 9000 | ${medusaRss ? `${medusaRss} MB` : "ölçülmedi"} | 512 MB | ${medusaRss && medusaRss < 512 ? "✅ Bütçe İçi" : "⚠️ Kontrol"} |\n`;
  mdContent += `| Next.js Web | 3100 | ${webRss ? `${webRss} MB` : "ölçülmedi"} | 384 MB | ${webRss && webRss < 384 ? "✅ Bütçe İçi" : "⚠️ Kontrol"} |\n`;
  mdContent += `| Toplam Node Heap/RSS | - | ${medusaRss && webRss ? `${(medusaRss + webRss).toFixed(1)} MB` : "ölçülmedi"} | ~896 MB | ${medusaRss && webRss && medusaRss + webRss < 896 ? "✅ Bütçe İçi" : "⚠️ Kontrol"} |\n`;

  const outPath = path.resolve(process.cwd(), "docs/QUALITY-BASELINE.md");
  fs.writeFileSync(outPath, mdContent, "utf8");
  console.log(`\nBaşarıyla güncellendi: ${outPath}`);
}

main().catch((err) => {
  console.error("Ölçüm betiği kritik hata:", err);
  process.exit(1);
});
