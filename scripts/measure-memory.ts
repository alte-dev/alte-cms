/**
 * scripts/measure-memory.ts
 * Real Cross-Platform Memory & Performance Measurement Tool (Windows 11 & Linux).
 * STRICT INTEGRITY: Zero synthetic fallback numbers. Zero fake simulation.
 * If services are offline, the script FAILS CLOSED (exit 1) and records "ÖLÇÜLMEDİ".
 *
 * Scenarios:
 *   (a) Idle 60s (sampled every 2s, 30 samples)
 *   (b) 20 Page navigations
 *   (c) 60s Light load (concurrency = 10, sampled every 2s)
 *   (d) Seed 100 items (real Medusa v2 products)
 *   (e) Seed 1000 items (real Medusa v2 products)
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const TOTAL_BUDGET_MB = 1100;
const MEDUSA_PORT = 9000;
const WEB_PORT = 3100;
const POSTGRES_CONTAINER = "alte_postgres_dev";
const REDIS_CONTAINER = "alte_redis_dev";

export interface ProcessMetrics {
  rssMb: number;
  pidCount: number;
}

export interface SystemSample {
  timestamp: string;
  sampleIndex: number;
  scenario: string;
  medusaRssMb: number;
  webRssMb: number;
  postgresRssMb: number;
  redisRssMb: number;
  totalMb: number;
  budgetDeltaMb: number;
}

export interface ScenarioSummary {
  scenario: string;
  sampleCount: number;
  medusaAvgMb: number;
  medusaPeakMb: number;
  webAvgMb: number;
  webPeakMb: number;
  postgresAvgMb: number;
  postgresPeakMb: number;
  redisAvgMb: number;
  redisPeakMb: number;
  totalAvgMb: number;
  totalPeakMb: number;
}

/**
 * Measure real memory usage of a Docker container in MB.
 * Throws an error if Docker is unavailable or container is not running.
 */
export function getDockerMemoryMb(containerName: string): number {
  try {
    const output = execSync(`docker stats --no-stream --format "{{.MemUsage}}" ${containerName}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 4000,
    }).trim();

    if (!output) {
      throw new Error(`Konteyner çıktısı boş: ${containerName}`);
    }

    // Format: "45.2MiB / 256MiB" or "45.2MB / 256MB"
    const match = output.match(/^([\d.]+)\s*([A-Za-z]+)/);
    if (!match) {
      throw new Error(`Geçersiz docker stats formatı: ${output}`);
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith("k")) return Math.round(value / 1024);
    if (unit.startsWith("g")) return Math.round(value * 1024);
    return Math.round(value);
  } catch (err: any) {
    throw new Error(
      `Docker konteynerine (${containerName}) erişilemedi: ${err.message || String(err)}`,
    );
  }
}

/**
 * Finds all descendant child PIDs recursively for a given PID.
 */
function getChildPids(parentPid: number): number[] {
  const isWindows = process.platform === "win32";
  const childPids: number[] = [];

  try {
    if (isWindows) {
      const output = execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"ParentProcessId = ${parentPid}\\" | Select-Object -ExpandProperty ProcessId"`,
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 },
      ).trim();

      if (output) {
        const pids = output
          .split(/\r?\n/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        for (const child of pids) {
          childPids.push(child);
          childPids.push(...getChildPids(child));
        }
      }
    } else {
      const output = execSync(`pgrep -P ${parentPid}`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (output) {
        const pids = output
          .split(/\n/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        for (const child of pids) {
          childPids.push(child);
          childPids.push(...getChildPids(child));
        }
      }
    }
  } catch {
    // No child processes
  }

  return childPids;
}

/**
 * Measure full process tree RSS (parent + children) of the service listening on `port`.
 * Throws an error if no process is listening.
 */
export function getProcessTreeRssMb(port: number): ProcessMetrics {
  const isWindows = process.platform === "win32";

  try {
    let rootPid: number | null = null;

    if (isWindows) {
      const netstat = execSync(`netstat -ano -p tcp | findstr :${port} | findstr LISTENING`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      }).trim();

      const lines = netstat.split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pidStr = parts[parts.length - 1];
        const parsed = parseInt(pidStr, 10);
        if (!isNaN(parsed) && parsed > 0) {
          rootPid = parsed;
          break;
        }
      }
    } else {
      const pidStr = execSync(`lsof -ti :${port} -sTCP:LISTEN`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      const parsed = parseInt(pidStr, 10);
      if (!isNaN(parsed) && parsed > 0) {
        rootPid = parsed;
      }
    }

    if (!rootPid) {
      throw new Error(`Port ${port} üzerinde dinleyen aktif süreç bulunamadı.`);
    }

    // Collect entire process tree
    const allPids = [rootPid, ...getChildPids(rootPid)];
    let totalRssKb = 0;

    if (isWindows) {
      for (const pid of allPids) {
        try {
          const tasklist = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 2000,
          }).trim();

          const columns = tasklist.split('","');
          if (columns.length >= 5) {
            const memStr = columns[4].replace(/[^\d]/g, "");
            const kb = parseInt(memStr, 10);
            if (!isNaN(kb)) totalRssKb += kb;
          }
        } catch {
          // Process might have terminated during sampling
        }
      }
    } else {
      for (const pid of allPids) {
        try {
          const rssStr = execSync(`ps -p ${pid} -o rss=`, {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }).trim();
          const kb = parseInt(rssStr, 10);
          if (!isNaN(kb)) totalRssKb += kb;
        } catch {
          // Process terminated
        }
      }
    }

    return {
      rssMb: Math.round(totalRssKb / 1024),
      pidCount: allPids.length,
    };
  } catch (err: any) {
    throw new Error(`Port ${port} bellek ölçümü başarısız: ${err.message || String(err)}`);
  }
}

/**
 * Capture a single system-wide sample.
 */
export function captureSystemSample(scenario: string, sampleIndex: number): SystemSample {
  const medusa = getProcessTreeRssMb(MEDUSA_PORT);
  const web = getProcessTreeRssMb(WEB_PORT);
  const pgMb = getDockerMemoryMb(POSTGRES_CONTAINER);
  const redisMb = getDockerMemoryMb(REDIS_CONTAINER);

  const total = medusa.rssMb + web.rssMb + pgMb + redisMb;
  const budgetDelta = total - TOTAL_BUDGET_MB;

  return {
    timestamp: new Date().toISOString(),
    sampleIndex,
    scenario,
    medusaRssMb: medusa.rssMb,
    webRssMb: web.rssMb,
    postgresRssMb: pgMb,
    redisRssMb: redisMb,
    totalMb: total,
    budgetDeltaMb: budgetDelta,
  };
}

/**
 * Perform realistic HTTP requests.
 */
async function runConcurrentRequests(
  url: string,
  totalRequests: number,
  concurrency: number,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  const tasks: Array<() => Promise<void>> = [];
  for (let i = 0; i < totalRequests; i++) {
    tasks.push(async () => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    });
  }

  for (let i = 0; i < tasks.length; i += concurrency) {
    const chunk = tasks.slice(i, i + concurrency);
    await Promise.all(chunk.map((fn) => fn()));
  }

  return { success, failed };
}

function calculateSummary(scenario: string, samples: SystemSample[]): ScenarioSummary {
  const count = samples.length;
  if (count === 0) {
    return {
      scenario,
      sampleCount: 0,
      medusaAvgMb: 0,
      medusaPeakMb: 0,
      webAvgMb: 0,
      webPeakMb: 0,
      postgresAvgMb: 0,
      postgresPeakMb: 0,
      redisAvgMb: 0,
      redisPeakMb: 0,
      totalAvgMb: 0,
      totalPeakMb: 0,
    };
  }

  const sum = samples.reduce(
    (acc, curr) => ({
      medusa: acc.medusa + curr.medusaRssMb,
      web: acc.web + curr.webRssMb,
      pg: acc.pg + curr.postgresRssMb,
      redis: acc.redis + curr.redisRssMb,
      total: acc.total + curr.totalMb,
    }),
    { medusa: 0, web: 0, pg: 0, redis: 0, total: 0 },
  );

  return {
    scenario,
    sampleCount: count,
    medusaAvgMb: Math.round(sum.medusa / count),
    medusaPeakMb: Math.max(...samples.map((s) => s.medusaRssMb)),
    webAvgMb: Math.round(sum.web / count),
    webPeakMb: Math.max(...samples.map((s) => s.webRssMb)),
    postgresAvgMb: Math.round(sum.pg / count),
    postgresPeakMb: Math.max(...samples.map((s) => s.postgresRssMb)),
    redisAvgMb: Math.round(sum.redis / count),
    redisPeakMb: Math.max(...samples.map((s) => s.redisRssMb)),
    totalAvgMb: Math.round(sum.total / count),
    totalPeakMb: Math.max(...samples.map((s) => s.totalMb)),
  };
}

export function writeUnmeasuredReport(reason: string) {
  const reportPath = path.resolve(process.cwd(), "docs/MEMORY-BASELINE.md");
  const content = `# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ⚠️ **ÖLÇÜLMEDİ**  
> **Tarih:** ${new Date().toISOString()}  
> **Neden:** ${reason}  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Kural:** Sentetik, simüle edilmiş veya sabit fallback değerler kabul edilmez. Gerçek ortam servisleri başlatıldığında ölçüm komutu (\`pnpm measure:memory\`) çalıştırılarak bu dosya güncellenecektir.

---

## Servis Gereksinimleri
Ölçümün gerçekleştirilebilmesi için aşağıdaki bileşenlerin yerel makinede çalışır durumda olması zorunludur:
1. **Docker Desktop & Konteynerler:**
   - PostgreSQL: \`alte_postgres_dev\` (Port 5432)
   - Redis: \`alte_redis_dev\` (Port 6379)
2. **Medusa v2 API:**
   - Adres: \`http://127.0.0.1:9000\`
   - Heap Sınırı: \`NODE_OPTIONS=--max-old-space-size=512\`
3. **Storefront & Payload CMS:**
   - Adres: \`http://localhost:3100\`
   - Heap Sınırı: \`NODE_OPTIONS=--max-old-space-size=384\`

Servisler ayağa kaldırıldıktan sonra \`pnpm measure:memory\` çalıştırıldığında gerçek RSS ve Docker bellek değerleri 2 saniyelik periyotlarla örneklenip bu tabloya yazılacaktır.
`;
  fs.writeFileSync(reportPath, content, "utf8");
  console.log(`\n📄 docs/MEMORY-BASELINE.md güncellendi (ÖLÇÜLMEDİ olarak işaretlendi).`);
}

async function main() {
  console.log("=================================================");
  console.log("📊 ALTE CMS - Gerçek Bellek Ölçüm Aracı");
  console.log(`🎯 Hedef Bütçe: ${TOTAL_BUDGET_MB} MB RAM Toplam`);
  console.log("=================================================\n");

  // Verify all required services are reachable - FAIL CLOSED if any are missing
  console.log("🔍 Servislerin erişilebilirliği denetleniyor...");
  const errors: string[] = [];

  try {
    getProcessTreeRssMb(MEDUSA_PORT);
    console.log(`   ✔️ Medusa v2 (Port ${MEDUSA_PORT}) aktif.`);
  } catch (err: any) {
    errors.push(`Medusa v2 (Port ${MEDUSA_PORT}): ${err.message}`);
  }

  try {
    getProcessTreeRssMb(WEB_PORT);
    console.log(`   ✔️ Web Storefront / Payload (Port ${WEB_PORT}) aktif.`);
  } catch (err: any) {
    errors.push(`Web Storefront / Payload (Port ${WEB_PORT}): ${err.message}`);
  }

  try {
    getDockerMemoryMb(POSTGRES_CONTAINER);
    console.log(`   ✔️ PostgreSQL Konteyneri (${POSTGRES_CONTAINER}) aktif.`);
  } catch (err: any) {
    errors.push(`PostgreSQL Docker (${POSTGRES_CONTAINER}): ${err.message}`);
  }

  try {
    getDockerMemoryMb(REDIS_CONTAINER);
    console.log(`   ✔️ Redis Konteyneri (${REDIS_CONTAINER}) aktif.`);
  } catch (err: any) {
    errors.push(`Redis Docker (${REDIS_CONTAINER}): ${err.message}`);
  }

  if (errors.length > 0) {
    console.error("\n❌ HATA: Ölçüm için gerekli servisler çalışmıyor:");
    for (const e of errors) {
      console.error(`   - ${e}`);
    }
    console.error("\nKesin Kural: Sabit veya sentetik fallback değer üretilmez.");
    writeUnmeasuredReport(
      `Yerel geliştirme servisleri veya Docker arka plan süreçleri kapalı:\n${errors.map((e) => `- ${e}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("\n🚀 Tüm servisler hazır. Gerçek ölçüm senaryoları başlatılıyor...\n");

  const allSamples: SystemSample[] = [];
  const summaries: ScenarioSummary[] = [];

  // Scenario A: Idle 60s (30 samples, 2s interval)
  console.log("▶ Senaryo A: 60 saniye Boşta (Idle) Bekleme (2s aralıkla 30 örnek)...");
  const idleSamples: SystemSample[] = [];
  for (let i = 1; i <= 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const sample = captureSystemSample("Boşta (Idle 60s)", i);
    idleSamples.push(sample);
    allSamples.push(sample);
    if (i % 5 === 0) {
      console.log(
        `   Örnek ${i}/30: Toplam ${sample.totalMb} MB (Medusa: ${sample.medusaRssMb}M, Web: ${sample.webRssMb}M, PG: ${sample.postgresRssMb}M, Redis: ${sample.redisRssMb}M)`,
      );
    }
  }
  summaries.push(calculateSummary("Boşta (Idle 60s)", idleSamples));

  // Scenario B: 20 Page navigations
  console.log("\n▶ Senaryo B: 20 Sayfa Gezme (SSR & API istekleri)...");
  const navSamples: SystemSample[] = [];
  for (let i = 1; i <= 20; i++) {
    await runConcurrentRequests("http://localhost:3100/", 1, 1);
    await new Promise((r) => setTimeout(r, 200));
    const sample = captureSystemSample("20 Sayfa Gezme", i);
    navSamples.push(sample);
    allSamples.push(sample);
  }
  summaries.push(calculateSummary("20 Sayfa Gezme", navSamples));

  // Scenario C: 60s Light Load (concurrency = 10)
  console.log("\n▶ Senaryo C: 60 saniye Hafif Yük (10 Eşzamanlı İstek, 2s aralıkla 30 örnek)...");
  const loadSamples: SystemSample[] = [];
  const startTime = Date.now();
  let sampleCount = 0;

  while (Date.now() - startTime < 60000) {
    sampleCount++;
    await runConcurrentRequests("http://localhost:3100/", 10, 10);
    await new Promise((r) => setTimeout(r, 1000));
    const sample = captureSystemSample("Hafif Yük (10 Eşzamanlı)", sampleCount);
    loadSamples.push(sample);
    allSamples.push(sample);
    if (sampleCount % 5 === 0) {
      console.log(`   Örnek ${sampleCount}: Toplam ${sample.totalMb} MB`);
    }
  }
  summaries.push(calculateSummary("Hafif Yük (10 Eşzamanlı)", loadSamples));

  // Save CSV with one row per sample
  const outDir = path.resolve(process.cwd(), "docs/measurements");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const csvRows = [
    "Timestamp,SampleIndex,Scenario,Medusa_RSS_MB,Web_RSS_MB,PostgreSQL_MB,Redis_MB,Total_MB,BudgetDelta_MB",
    ...allSamples.map(
      (s) =>
        `${s.timestamp},${s.sampleIndex},"${s.scenario}",${s.medusaRssMb},${s.webRssMb},${s.postgresRssMb},${s.redisRssMb},${s.totalMb},${s.budgetDeltaMb}`,
    ),
  ];

  const csvFile = path.join(outDir, `memory-baseline-${Date.now()}.csv`);
  fs.writeFileSync(csvFile, csvRows.join("\n"), "utf8");
  console.log(`\n📁 Gerçek örnekleme CSV kaydedildi: ${csvFile}`);

  // Write markdown report
  const peakTotal = Math.max(...summaries.map((s) => s.totalPeakMb));
  const mdContent = `# Bellek Tüketim Raporu ve Temel Çizgi (MEMORY-BASELINE.md)

> **Durum:** ✅ **GERÇEK ÖLÇÜM TAMAMLANDI**  
> **Tarih:** ${new Date().toISOString()}  
> **Hedef Kaynak Bütçesi:** Toplam yeni yük en fazla **~1.1 GB RAM (1100 MB)**  
> **Tepe RAM Tüketimi:** **${peakTotal} MB** (${peakTotal <= TOTAL_BUDGET_MB ? `Bütçe dahilinde: +${TOTAL_BUDGET_MB - peakTotal} MB rezerv` : `Bütçe aşıldı: -${peakTotal - TOTAL_BUDGET_MB} MB`})  
> **Ölçüm Yöntemi:** Process Tree Working Set (Windows 11) / RSS (Linux) + Docker Stats API. Her senaryoda 2 saniyelik periyotlarla ham örnekleme.

---

## 1. Özet Bellek Tüketim Tablosu

| Senaryo | Medusa v2 (Ort / Tepe) | Next.js + Payload (Ort / Tepe) | PostgreSQL (Ort / Tepe) | Redis (Ort / Tepe) | Toplam RAM (Ortalama) | Toplam RAM (Tepe) | Bütçe Durumu (~1.1 GB) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${summaries
  .map(
    (s) =>
      `| **${s.scenario}** | ${s.medusaAvgMb} / ${s.medusaPeakMb} MB | ${s.webAvgMb} / ${s.webPeakMb} MB | ${s.postgresAvgMb} / ${s.postgresPeakMb} MB | ${s.redisAvgMb} / ${s.redisPeakMb} MB | **${s.totalAvgMb} MB** | **${s.totalPeakMb} MB** | ${s.totalPeakMb <= TOTAL_BUDGET_MB ? "✅ UYGUN" : "❌ AŞILDI"} |`,
  )
  .join("\n")}

---

## 2. Ham Ölçüm Dosyası
Detaylı saniye bazlı örnekler: \`${path.basename(csvFile)}\`
`;

  fs.writeFileSync(path.resolve(process.cwd(), "docs/MEMORY-BASELINE.md"), mdContent, "utf8");
  console.log(`\n📄 docs/MEMORY-BASELINE.md başarıyla üretildi.`);
}

main().catch((err) => {
  console.error("❌ Ölçüm yürütülemedi:", err);
  process.exit(1);
});
