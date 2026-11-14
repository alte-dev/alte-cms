/**
 * scripts/verify-all.ts
 *
 * FAZ 11.5 — Master Live Verification Runner (`pnpm verify:all`)
 *
 * Runs all verification suites in strict order:
 *  1. verify:store
 *  2. verify:storefront
 *  3. verify:checkout (starts temporary `next dev` on port 3101 if main server is `next start`)
 *  4. verify:payments
 *  5. verify:content
 *  6. verify:search
 *  7. verify:notifications
 *  8. verify:order-ops
 *  9. verify:quality
 * 10. verify-production-guard
 *
 * Writes raw logs to `verify-logs/<script>.log` and summary table to `verify-logs/SUMMARY.md`.
 * Runs remaining suites even if one fails; exits with non-zero code if any suite failed.
 */

import { spawn, spawnSync, type ChildProcess } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

function loadEnvIfPresent(relPath: string): void {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return;
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) {
      process.env[key] = rawVal;
    }
  }
}

loadEnvIfPresent("apps/medusa/.env");
loadEnvIfPresent("apps/web/.env");
loadEnvIfPresent(".env");

export interface VerifyCommandSpec {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
  beforeRun?: () => Promise<Record<string, string> | void>;
  afterRun?: () => Promise<void>;
}

export interface VerifyCommandResult {
  name: string;
  exitCode: number;
  durationMs: number;
  logFile: string;
}

export interface VerifyAllSummary {
  exitCode: number;
  results: VerifyCommandResult[];
  summaryPath: string;
}

export interface RunVerifyOptions {
  logDir?: string;
  quiet?: boolean;
}

function killProcessTree(proc: ChildProcess | null): void {
  if (!proc || !proc.pid) return;
  proc.stdout?.destroy();
  proc.stderr?.destroy();
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      try {
        process.kill(-proc.pid, "SIGKILL");
      } catch {
        proc.kill("SIGKILL");
      }
    }
  } catch {
    // ignore cleanup errors
  }
}

async function canBindPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, () => {
      srv.close(() => resolve(true));
    });
  });
}

async function findFreePort(preferredPort: number): Promise<number> {
  for (const candidate of [preferredPort, 3301, 3401]) {
    if (await canBindPort(candidate)) {
      return candidate;
    }
  }
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function resolveActiveWebUrl(): Promise<string> {
  const explicit = process.env.STOREFRONT_URL || process.env.WEB_URL || process.env.WEB_PUBLIC_URL;
  if (explicit) {
    try {
      const r = await fetch(`${explicit}/`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return explicit;
    } catch {
      // fall through to probe candidates
    }
  }

  const candidates = ["http://localhost:3100", "http://127.0.0.1:3100", "http://localhost:3300"];
  for (const url of candidates) {
    try {
      const r = await fetch(`${url}/`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return url;
    } catch {
      // try next
    }
  }

  return explicit || "http://localhost:3100";
}

async function isNextProductionStartServer(webUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${webUrl}/`, { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    // In `next dev`, the runtime chunk is `/_next/static/chunks/webpack.js` (unhashed).
    // In `next start` (production build), it is `/_next/static/chunks/webpack-<hash>.js`.
    return !html.includes("/_next/static/chunks/webpack.js");
  } catch {
    return false;
  }
}

export async function runVerifyCommands(
  specs: VerifyCommandSpec[],
  options: RunVerifyOptions = {},
): Promise<VerifyAllSummary> {
  const logDir = options.logDir || path.resolve(process.cwd(), "verify-logs");
  const quiet = Boolean(options.quiet);

  fs.mkdirSync(logDir, { recursive: true });

  const results: VerifyCommandResult[] = [];

  for (const spec of specs) {
    const safeName = spec.name.replace(/[^a-zA-Z0-9_-]/g, "-");
    const logFile = path.join(logDir, `${safeName}.log`);
    const startTime = Date.now();

    if (!quiet) {
      console.log(`\n==================================================================`);
      console.log(`▶ ÇALIŞTIRILIYOR: ${spec.name}`);
      console.log(`==================================================================`);
    }

    let dynamicEnv: Record<string, string> = {};
    try {
      if (spec.beforeRun) {
        const extra = await spec.beforeRun();
        if (extra) dynamicEnv = extra;
      }

      const exitCode = await new Promise<number>((resolve) => {
        const outStream = fs.createWriteStream(logFile, { flags: "w" });
        const mergedEnv: NodeJS.ProcessEnv = {
          ...process.env,
          ...(spec.env || {}),
          ...dynamicEnv,
        };

        const child = spawn(spec.command, spec.args, {
          cwd: process.cwd(),
          env: mergedEnv,
          shell: false,
        });

        child.stdout?.on("data", (chunk: Buffer) => {
          outStream.write(chunk);
          if (!quiet) process.stdout.write(chunk);
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          outStream.write(chunk);
          if (!quiet) process.stderr.write(chunk);
        });

        child.on("error", (err) => {
          outStream.write(`\n[SPAWN ERROR] ${err.message}\n`);
          outStream.end(() => resolve(1));
        });

        child.on("close", (code) => {
          outStream.end(() => resolve(code ?? 1));
        });
      });

      const durationMs = Date.now() - startTime;
      results.push({
        name: spec.name,
        exitCode,
        durationMs,
        logFile,
      });

      if (!quiet) {
        const statusIcon = exitCode === 0 ? "✅ PASS" : `❌ FAIL (exit ${exitCode})`;
        console.log(
          `\n${statusIcon} — ${spec.name} (${(durationMs / 1000).toFixed(1)}s) -> ${path.relative(process.cwd(), logFile)}`,
        );
      }
    } catch (err) {
      const durationMs = Date.now() - startTime;
      fs.writeFileSync(
        logFile,
        `[RUNNER ERROR] ${(err as Error).stack || (err as Error).message}\n`,
      );
      results.push({
        name: spec.name,
        exitCode: 1,
        durationMs,
        logFile,
      });
    } finally {
      if (spec.afterRun) {
        await spec.afterRun().catch(() => {});
      }
    }
  }

  const summaryPath = path.join(logDir, "SUMMARY.md");
  const totalDurationSec = (results.reduce((acc, r) => acc + r.durationMs, 0) / 1000).toFixed(1);
  const anyFailed = results.some((r) => r.exitCode !== 0);

  const mdLines = [
    "# Canlı Doğrulama Özeti (`pnpm verify:all`)",
    "",
    `- **Tarih:** ${new Date().toISOString()}`,
    `- **Genel Durum:** ${anyFailed ? "❌ BAŞARISIZ" : "✅ TÜMÜ GEÇTİ"}`,
    `- **Toplam Süre:** ${totalDurationSec}s`,
    "",
    "| Betik | Durum | Çıkış Kodu | Süre (sn) | Günlük Dosyası |",
    "| --- | --- | --- | --- | --- |",
    ...results.map((r) => {
      const status = r.exitCode === 0 ? "✅ PASS" : "❌ FAIL";
      const sec = (r.durationMs / 1000).toFixed(1);
      const relLog = path.basename(r.logFile);
      return `| \`${r.name}\` | ${status} | \`${r.exitCode}\` | ${sec}s | \`${relLog}\` |`;
    }),
    "",
  ];

  fs.writeFileSync(summaryPath, mdLines.join("\n"), "utf8");

  if (!quiet) {
    console.log("\n==================================================================");
    console.log("📊 DOĞRULAMA ÖZETİ (verify-logs/SUMMARY.md)");
    console.log("==================================================================");
    console.log(mdLines.join("\n"));
  }

  return {
    exitCode: anyFailed ? 1 : 0,
    results,
    summaryPath,
  };
}

async function main() {
  const tsxCli = path.resolve(process.cwd(), "node_modules/tsx/dist/cli.mjs");
  const webUrl = await resolveActiveWebUrl();
  const medusaUrl = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";

  const sharedEnv: Record<string, string> = {
    WEB_URL: webUrl,
    WEB_PUBLIC_URL: webUrl,
    STOREFRONT_URL: webUrl,
    TEST_WEB_URL: webUrl,
    MEDUSA_URL: medusaUrl,
    MEDUSA_BACKEND_URL: medusaUrl,
    ALLOW_DEV_PAYMENT: "true",
  };

  let tempNextDevProc: ChildProcess | null = null;
  let savedTsconfig = "";
  let savedNextEnv = "";
  const tsconfigPath = path.resolve(process.cwd(), "apps/web/tsconfig.json");
  const nextEnvPath = path.resolve(process.cwd(), "apps/web/next-env.d.ts");

  const scriptsToRun: Array<{ name: string; script: string; needsDevServer?: boolean }> = [
    { name: "verify:store", script: "scripts/verify-store.ts" },
    { name: "verify:storefront", script: "scripts/verify-storefront.ts" },
    { name: "verify:checkout", script: "scripts/verify-checkout.ts", needsDevServer: true },
    { name: "verify:payments", script: "scripts/verify-payments.ts" },
    { name: "verify:content", script: "scripts/verify-content.ts" },
    { name: "verify:search", script: "scripts/verify-search.ts" },
    { name: "verify:notifications", script: "scripts/verify-notifications.ts" },
    { name: "verify:order-ops", script: "scripts/verify-order-ops.ts" },
    { name: "verify:accounts", script: "scripts/verify-accounts.ts" },
    { name: "verify:quality", script: "scripts/verify-quality.ts" },
    { name: "verify-production-guard", script: "scripts/verify-production-guard.ts" },
  ];

  const specs: VerifyCommandSpec[] = scriptsToRun.map((item) => ({
    name: item.name,
    command: process.execPath,
    args: [tsxCli, item.script],
    env: sharedEnv,
    beforeRun: item.needsDevServer
      ? async () => {
          if (process.env.CHECKOUT_STOREFRONT_URL) {
            return {
              STOREFRONT_URL: process.env.CHECKOUT_STOREFRONT_URL,
              WEB_URL: process.env.CHECKOUT_STOREFRONT_URL,
            };
          }
          const isProdStart = await isNextProductionStartServer(webUrl);
          if (!isProdStart) {
            return { STOREFRONT_URL: webUrl, WEB_URL: webUrl };
          }

          const devPort = await findFreePort(3101);
          const devUrl = `http://localhost:${devPort}`;
          console.log(
            `[verify:all] Ana web sunucusu (${webUrl}) production modunda; verify:checkout için geçici 'next dev' (${devUrl}) başlatılıyor...`,
          );

          if (fs.existsSync(tsconfigPath)) savedTsconfig = fs.readFileSync(tsconfigPath, "utf8");
          if (fs.existsSync(nextEnvPath)) savedNextEnv = fs.readFileSync(nextEnvPath, "utf8");

          const nextBin = path.resolve(process.cwd(), "apps/web/node_modules/next/dist/bin/next");
          tempNextDevProc = spawn(process.execPath, [nextBin, "dev", "-p", String(devPort)], {
            cwd: path.resolve(process.cwd(), "apps/web"),
            env: {
              ...process.env,
              ...sharedEnv,
              NODE_ENV: "development",
              ALLOW_DEV_PAYMENT: "true",
              NEXT_DIST_DIR: ".next-dev",
              PORT: String(devPort),
            },
            stdio: "ignore",
            detached: process.platform !== "win32",
          });

          let ready = false;
          for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 1000));
            try {
              const probe = await fetch(`${devUrl}/`, { signal: AbortSignal.timeout(3000) });
              if (probe.ok) {
                ready = true;
                break;
              }
            } catch {
              // waiting for next dev
            }
          }

          if (!ready) {
            killProcessTree(tempNextDevProc);
            tempNextDevProc = null;
            throw new Error(
              `Geçici next dev sunucusu (${devUrl}) 60 saniye içinde ayağa kalkmadı.`,
            );
          }

          return {
            STOREFRONT_URL: devUrl,
            WEB_URL: devUrl,
          };
        }
      : undefined,
    afterRun: item.needsDevServer
      ? async () => {
          if (tempNextDevProc) {
            console.log(`[verify:all] Geçici 'next dev' sunucusu kapatılıyor...`);
            killProcessTree(tempNextDevProc);
            tempNextDevProc = null;
            try {
              fs.rmSync(path.resolve(process.cwd(), "apps/web/.next-dev"), {
                recursive: true,
                force: true,
              });
              if (savedTsconfig) fs.writeFileSync(tsconfigPath, savedTsconfig, "utf8");
              if (savedNextEnv) fs.writeFileSync(nextEnvPath, savedNextEnv, "utf8");
            } catch {
              // ignore cleanup errors
            }
          }
        }
      : undefined,
  }));

  const summary = await runVerifyCommands(specs);
  process.exit(summary.exitCode);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFilePath)) {
  main().catch((err) => {
    console.error("Fatal error in verify:all:", err);
    process.exit(1);
  });
}
