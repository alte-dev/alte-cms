/**
 * Smoke Test: Connectivity and CORS Verification
 * Validates communication between Next.js (storefront/Payload) and Medusa v2:
 * 1. Server-side loopback access (127.0.0.1:9000)
 * 2. Browser simulated access & CORS Preflight (NEXT_PUBLIC_MEDUSA_URL / api.localhost:9000)
 * 3. Storefront SSR verification (localhost:3100)
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });
dotenv.config();

interface TestResult {
  name: string;
  url: string;
  status: "PASSED" | "FAILED";
  statusCode?: number;
  details: string;
}

const results: TestResult[] = [];

async function runSmokeTests() {
  console.log("=================================================");
  console.log("🚀 ALTE CMS - Smoke Test & Connectivity Diagnostic");
  console.log("=================================================\n");

  const serverUrl = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";
  const browserUrl = process.env.NEXT_PUBLIC_MEDUSA_URL || "http://api.localhost:9000";
  const webUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3100";

  // Test 1: Node/Server-side Loopback connectivity (127.0.0.1:9000)
  try {
    const healthUrl = `${serverUrl}/health`;
    console.log(`[1/3] Testing Server-side loopback: ${healthUrl}...`);
    const res = await fetch(healthUrl, { method: "GET" });
    if (res.ok || res.status === 200) {
      results.push({
        name: `Server-side Loopback (${healthUrl})`,
        url: healthUrl,
        status: "PASSED",
        statusCode: res.status,
        details: "Medusa responded successfully to server loopback.",
      });
    } else {
      results.push({
        name: `Server-side Loopback (${healthUrl})`,
        url: healthUrl,
        status: "FAILED",
        statusCode: res.status,
        details: `Unexpected HTTP status: ${res.status} ${res.statusText}`,
      });
    }
  } catch (err: any) {
    results.push({
      name: `Server-side Loopback (${serverUrl}/health)`,
      url: `${serverUrl}/health`,
      status: "FAILED",
      details: `Connection failed: ${err.message}. Is Medusa running?`,
    });
  }

  // Test 2: Browser CORS Preflight (OPTIONS request to NEXT_PUBLIC_MEDUSA_URL: api.localhost:9000)
  const parsedBrowserUrl = new URL(browserUrl);
  const corsUrl = `${browserUrl}/store/products`;
  console.log(`[2/3] Testing Browser CORS Preflight: OPTIONS ${corsUrl}...`);

  try {
    const optionsRes = await fetch(corsUrl, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3100",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    const allowOrigin = optionsRes.headers.get("access-control-allow-origin");
    if (optionsRes.ok && (allowOrigin === "http://localhost:3100" || allowOrigin === "*")) {
      results.push({
        name: `Browser CORS Preflight (${corsUrl})`,
        url: corsUrl,
        status: "PASSED",
        statusCode: optionsRes.status,
        details: `CORS preflight succeeded directly against ${corsUrl}. Allow-Origin: ${allowOrigin}`,
      });
    } else {
      results.push({
        name: `Browser CORS Preflight (${corsUrl})`,
        url: corsUrl,
        status: "FAILED",
        statusCode: optionsRes.status,
        details: `CORS header mismatch or failed. Allow-Origin: ${allowOrigin || "None"}, Status: ${optionsRes.status}`,
      });
    }
  } catch (err: any) {
    console.warn(`   ⚠️ Doğrudan bağlantı çözümlenemedi (${corsUrl}): ${err.message}`);

    // Fallback: test 127.0.0.1 with Host header to verify server-side CORS preflight handler
    const fallbackPort = parsedBrowserUrl.port || "9000";
    const fallbackUrl = `http://127.0.0.1:${fallbackPort}/store/products`;
    const hostHeader = parsedBrowserUrl.host;
    console.log(
      `   🔄 Node DNS çözümleme sorunu: Yedek adres ile deneniyor: OPTIONS ${fallbackUrl} (Host: ${hostHeader})...`,
    );

    try {
      const fallbackRes = await fetch(fallbackUrl, {
        method: "OPTIONS",
        headers: {
          Host: hostHeader,
          Origin: "http://localhost:3100",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "content-type",
        },
      });

      const allowOrigin = fallbackRes.headers.get("access-control-allow-origin");
      if (fallbackRes.ok && (allowOrigin === "http://localhost:3100" || allowOrigin === "*")) {
        results.push({
          name: `Browser CORS Preflight (${corsUrl} [127.0.0.1 fallback])`,
          url: `${fallbackUrl} (Host: ${hostHeader})`,
          status: "PASSED",
          statusCode: fallbackRes.status,
          details: `Doğrudan DNS '${parsedBrowserUrl.hostname}' çözümlenemedi (${err.message}); 127.0.0.1 üzerinden 'Host: ${hostHeader}' başlığı ile CORS preflight başarıyla doğrulandı. Allow-Origin: ${allowOrigin}`,
        });
      } else {
        results.push({
          name: `Browser CORS Preflight (${corsUrl})`,
          url: `${fallbackUrl} (Host: ${hostHeader})`,
          status: "FAILED",
          statusCode: fallbackRes.status,
          details: `Doğrudan DNS başarısız (${err.message}) ve 127.0.0.1 üzerinden CORS başlığı eşleşmedi. Allow-Origin: ${allowOrigin || "None"}, Status: ${fallbackRes.status}`,
        });
      }
    } catch (fallbackErr: any) {
      results.push({
        name: `Browser CORS Preflight (${corsUrl})`,
        url: corsUrl,
        status: "FAILED",
        details: `api.localhost çözümlenemedi (${err.message}) ve 127.0.0.1 yedek adresi de başarısız oldu (${fallbackErr.message}). Medusa sunucusu port ${fallbackPort}'da çalışıyor mu?`,
      });
    }
  }

  // Test 3: Web Storefront SSR Health (localhost:3100)
  try {
    console.log(`[3/3] Testing Web Storefront SSR: ${webUrl}...`);
    const webRes = await fetch(webUrl, { method: "GET" });
    if (webRes.ok) {
      results.push({
        name: `Web Storefront SSR (${webUrl})`,
        url: webUrl,
        status: "PASSED",
        statusCode: webRes.status,
        details: "Storefront HTML rendered and served successfully.",
      });
    } else {
      results.push({
        name: `Web Storefront SSR (${webUrl})`,
        url: webUrl,
        status: "FAILED",
        statusCode: webRes.status,
        details: `SSR response returned status: ${webRes.status}`,
      });
    }
  } catch (err: any) {
    results.push({
      name: `Web Storefront SSR (${webUrl})`,
      url: webUrl,
      status: "FAILED",
      details: `SSR fetch failed: ${err.message}. Is Next.js running on port 3100?`,
    });
  }

  // Summary Report
  console.log("\n=================== TEST RESULTS ===================");
  let allPassed = true;

  for (const r of results) {
    const symbol = r.status === "PASSED" ? "✅" : "❌";
    console.log(`${symbol} [${r.status}] ${r.name}`);
    console.log(`   URL: ${r.url}`);
    if (r.statusCode) console.log(`   HTTP Status: ${r.statusCode}`);
    console.log(`   Info: ${r.details}\n`);
    if (r.status !== "PASSED") allPassed = false;
  }

  if (allPassed) {
    console.log("✨ All active smoke tests passed successfully!");
    process.exitCode = 0;
  } else {
    console.error("⚠️ Some smoke tests failed. Please review the diagnostics above.");
    process.exitCode = 1;
  }
}

runSmokeTests().catch((err) => {
  console.error("❌ Smoke test diagnostic encountered an unexpected fatal error:", err);
  process.exitCode = 1;
});
