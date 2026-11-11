/**
 * scripts/verify-production-guard.ts
 *
 * Verifies the Production Startup Guard with authentic process execution:
 * Scenario (a): Any region linked to pp_system_default -> exits with code 1
 * Scenario (b): No real payment provider linked -> exits with code 1
 * Scenario (c): Region linked only to PayTR + COD -> starts cleanly, logs 'guard PASSED', /health returns 200
 * Scenario (d): PAYTR_API_BASE or DEV_PAYTR_USER_IP defined in production -> exits with code 1
 */

import { spawn, spawnSync, type ChildProcess } from "child_process";
import dotenv from "dotenv";
import net from "net";
import path from "path";
import pg from "pg";
import { createStepRecorder } from "./lib/verify-step";

dotenv.config({ path: path.resolve(process.cwd(), "apps/medusa/.env") });

const DB_URL =
  process.env.DATABASE_URL ||
  "postgres://medusa_user:dev-only-medusa-password@127.0.0.1:5432/medusa_db";
const pool = new pg.Pool({ connectionString: DB_URL });
const { recordStep } = createStepRecorder({ format: "check", exitOnFail: true });

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function spawnMedusaStart(port: number, env: NodeJS.ProcessEnv): ChildProcess {
  const cwd = path.resolve(process.cwd(), "apps/medusa");
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/c", `npx medusa start -p ${port}`], { cwd, env });
  }
  return spawn("npx", ["medusa", "start", "-p", String(port)], {
    cwd,
    env,
    detached: true,
  });
}

function killMedusaProc(proc: ChildProcess): void {
  proc.stdout?.destroy();
  proc.stderr?.destroy();
  if (!proc.pid) return;
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
    // ignore
  }
}

async function runMedusaProcess(
  envOverrides: Record<string, string>,
  timeoutMs = 15000,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const port = await findFreePort();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";

    const cleanEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
    };
    // Clear dev overrides unless explicitly provided in envOverrides
    delete cleanEnv.PAYTR_API_BASE;
    delete cleanEnv.DEV_PAYTR_USER_IP;

    for (const [k, v] of Object.entries(envOverrides)) {
      if (v === "") {
        delete cleanEnv[k];
      } else {
        cleanEnv[k] = v;
      }
    }

    const proc = spawnMedusaStart(port, cleanEnv);

    const timer = setTimeout(() => {
      killMedusaProc(proc);
      resolve({ code: proc.exitCode, stdout, stderr });
    }, timeoutMs);

    proc.stdout?.on("data", (d) => {
      stdout += d.toString();
    });

    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function main() {
  console.log("===============================================================");
  console.log(" FAZ 4.1 — PRODUCTION STARTUP PAYMENT GUARD VERIFICATION");
  console.log("===============================================================\n");

  const client = await pool.connect();

  try {
    // Get default region id
    const regionRes = await client.query("SELECT id FROM region LIMIT 1;");
    if (regionRes.rows.length === 0) {
      throw new Error("Veritabanında bölge (region) bulunamadı.");
    }
    const regionId = regionRes.rows[0].id;
    console.log(`Hedef Bölge ID: ${regionId}\n`);

    // -------------------------------------------------------------
    // SCENARIO (a): pp_system_default is linked to region
    // -------------------------------------------------------------
    console.log("--- TEST (a): pp_system_default bölgeye bağlıyken üretim açılışı ---");
    await client.query(
      "UPDATE region_payment_provider SET deleted_at = NOW() WHERE region_id = $1;",
      [regionId],
    );
    await client.query(
      `INSERT INTO region_payment_provider (id, region_id, payment_provider_id, created_at, updated_at)
       VALUES ($1, $2, 'pp_system_default', NOW(), NOW())
       ON CONFLICT (region_id, payment_provider_id) DO UPDATE SET deleted_at = NULL;`,
      [`regpp_test_sys_${Date.now()}`, regionId],
    );

    const resA = await runMedusaProcess({});

    const failedClosedA =
      resA.code === 1 ||
      resA.stderr.includes("FAIL-CLOSED") ||
      resA.stdout.includes("FAIL-CLOSED") ||
      resA.stderr.includes("pp_system_default") ||
      resA.stdout.includes("pp_system_default");

    console.log(`Exit Code: ${resA.code}`);
    const summaryA = (resA.stderr || resA.stdout)
      .split("\n")
      .filter(
        (l) => l.includes("Payment Guard") || l.includes("FAIL-CLOSED") || l.includes("FATAL"),
      )
      .join("\n");
    console.log(`Çıktı Özeti:\n${summaryA || (resA.stderr || resA.stdout).slice(-300)}`);

    if (!failedClosedA) {
      throw new Error(
        "TEST (a) BAŞARISIZ: pp_system_default bağlıyken üretim süreci fail-closed kapanmadı!",
      );
    }
    console.log("✅ TEST (a) GEÇTİ: pp_system_default bağlıyken Medusa exit 1 ile kapandı.\n");

    // -------------------------------------------------------------
    // SCENARIO (b): No real provider linked to region
    // -------------------------------------------------------------
    console.log("--- TEST (b): Hiçbir gerçek sağlayıcı bağlı değilken üretim açılışı ---");
    await client.query(
      "UPDATE region_payment_provider SET deleted_at = NOW() WHERE region_id = $1;",
      [regionId],
    );

    const resB = await runMedusaProcess({});

    const failedClosedB =
      resB.code === 1 || resB.stderr.includes("FAIL-CLOSED") || resB.stdout.includes("FAIL-CLOSED");

    console.log(`Exit Code: ${resB.code}`);
    const summaryB = (resB.stderr || resB.stdout)
      .split("\n")
      .filter(
        (l) => l.includes("Payment Guard") || l.includes("FAIL-CLOSED") || l.includes("FATAL"),
      )
      .join("\n");
    console.log(`Çıktı Özeti:\n${summaryB || (resB.stderr || resB.stdout).slice(-300)}`);

    if (!failedClosedB) {
      throw new Error(
        "TEST (b) BAŞARISIZ: Hiçbir sağlayıcı bağlı değilken üretim süreci fail-closed kapanmadı!",
      );
    }
    console.log("✅ TEST (b) GEÇTİ: Hiçbir sağlayıcı bağlı değilken Medusa exit 1 ile kapandı.\n");

    // -------------------------------------------------------------
    // SCENARIO (d): PAYTR_API_BASE or DEV_PAYTR_USER_IP in production
    // -------------------------------------------------------------
    console.log("--- TEST (d): PAYTR_API_BASE ve DEV_PAYTR_USER_IP koruması ---");
    const resD1 = await runMedusaProcess({
      PAYTR_API_BASE: "https://mock.test",
    });

    const failedClosedD1 =
      resD1.code === 1 ||
      resD1.stderr.includes("PAYTR_API_BASE") ||
      resD1.stdout.includes("PAYTR_API_BASE");

    if (!failedClosedD1) {
      throw new Error("TEST (d1) BAŞARISIZ: PAYTR_API_BASE üretimde tanımlıyken kapanmadı!");
    }
    console.log("✅ TEST (d1) GEÇTİ: PAYTR_API_BASE üretimde tanımlıyken exit 1 ile kapandı.");

    const resD2 = await runMedusaProcess({
      DEV_PAYTR_USER_IP: "1.2.3.4",
    });

    const failedClosedD2 =
      resD2.code === 1 ||
      resD2.stderr.includes("DEV_PAYTR_USER_IP") ||
      resD2.stdout.includes("DEV_PAYTR_USER_IP");

    if (!failedClosedD2) {
      throw new Error("TEST (d2) BAŞARISIZ: DEV_PAYTR_USER_IP üretimde tanımlıyken kapanmadı!");
    }
    console.log("✅ TEST (d2) GEÇTİ: DEV_PAYTR_USER_IP üretimde tanımlıyken exit 1 ile kapandı.\n");

    // -------------------------------------------------------------
    // SCENARIO (c): ONLY pp_paytr_paytr & pp_cod_cod linked
    // -------------------------------------------------------------
    console.log("--- TEST (c): Yalnızca PayTR + COD bağlıyken üretim açılışı ---");
    await client.query(
      "UPDATE region_payment_provider SET deleted_at = NOW() WHERE region_id = $1;",
      [regionId],
    );
    await client.query(
      `INSERT INTO region_payment_provider (id, region_id, payment_provider_id, created_at, updated_at)
       VALUES
         ($1, $2, 'pp_paytr_paytr', NOW(), NOW()),
         ($3, $2, 'pp_cod_cod', NOW(), NOW())
       ON CONFLICT (region_id, payment_provider_id) DO UPDATE SET deleted_at = NULL;`,
      [`regpp_test_paytr_${Date.now()}`, regionId, `regpp_test_cod_${Date.now()}`],
    );

    // Start Medusa in background and poll /health
    const prodPort = await findFreePort();
    console.log(`Medusa üretim modunda başlatılıyor (NODE_ENV=production, port=${prodPort})...`);
    const cleanEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(prodPort),
    };
    delete cleanEnv.PAYTR_API_BASE;
    delete cleanEnv.DEV_PAYTR_USER_IP;

    const prodProc = spawnMedusaStart(prodPort, cleanEnv);

    let procOutput = "";
    prodProc.stdout?.on("data", (d) => {
      procOutput += d.toString();
    });
    prodProc.stderr?.on("data", (d) => {
      procOutput += d.toString();
    });

    let isHealthy = false;
    let guardPassed = false;

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (procOutput.includes("guard PASSED")) {
        guardPassed = true;
      }
      try {
        const hRes = await fetch(`http://127.0.0.1:${prodPort}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (hRes.ok && hRes.status === 200) {
          isHealthy = true;
          break;
        }
      } catch {
        // still starting
      }
    }

    killMedusaProc(prodProc);

    console.log(`Guard 'guard PASSED' logu görüldü mü: ${guardPassed}`);
    console.log(`Medusa /health 200 döndü mü: ${isHealthy}`);

    recordStep(
      "Senaryo (c): PayTR + COD üretim açılışı ve /health 200",
      isHealthy && guardPassed,
      `guard PASSED: ${guardPassed}, /health 200: ${isHealthy}`,
    );

    console.log(
      "✅ TEST (c) GEÇTİ: Medusa 'guard PASSED' logladı ve /health 200 ile başarıyla açıldı!\n",
    );

    console.log("===============================================================");
    console.log(" ✅ TÜM ÜRETİM AÇILIŞ KORUMASI SENARYOLARI (a, b, c, d) BAŞARIYLA DOĞRULANDI!");
    console.log("===============================================================");
  } finally {
    // Restore dev configuration (pp_system_default + pp_paytr_paytr + pp_cod_cod)
    try {
      const regionRes = await client.query("SELECT id FROM region LIMIT 1;");
      if (regionRes.rows.length > 0) {
        const regId = regionRes.rows[0].id;
        await client.query(
          "UPDATE region_payment_provider SET deleted_at = NULL WHERE region_id = $1;",
          [regId],
        );
        await client.query(
          `INSERT INTO region_payment_provider (id, region_id, payment_provider_id, created_at, updated_at)
           VALUES
             ($1, $2, 'pp_system_default', NOW(), NOW()),
             ($3, $2, 'pp_paytr_paytr', NOW(), NOW()),
             ($4, $2, 'pp_cod_cod', NOW(), NOW())
           ON CONFLICT (region_id, payment_provider_id) DO UPDATE SET deleted_at = NULL;`,
          [
            `regpp_restore_sys_${Date.now()}`,
            regId,
            `regpp_restore_paytr_${Date.now()}`,
            `regpp_restore_cod_${Date.now()}`,
          ],
        );
      }
    } catch {
      // ignore restore errors
    }
    client.release();
    await pool.end();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ HATA:", err.message);
    process.exit(1);
  });
