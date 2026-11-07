/**
 * Smoke Test: Connectivity and CORS Verification
 * Validates communication between Next.js (storefront/Payload) and Medusa v2:
 * 1. Server-side loopback access (127.0.0.1:9000)
 * 2. Browser simulated access & CORS Preflight (api.localhost:9000)
 * 3. Storefront SSR verification (localhost:3100)
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });
dotenv.config();

interface TestResult {
  name: string;
  url: string;
  status: "PASSED" | "FAILED" | "SKIPPED";
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
        name: "Server-side Loopback (127.0.0.1:9000/health)",
        url: healthUrl,
        status: "PASSED",
        statusCode: res.status,
        details: "Medusa responded successfully to server loopback.",
      });
    } else {
      results.push({
        name: "Server-side Loopback (127.0.0.1:9000/health)",
        url: healthUrl,
        status: "FAILED",
        statusCode: res.status,
        details: `Unexpected HTTP status: ${res.status} ${res.statusText}`,
      });
    }
  } catch (err: any) {
    results.push({
      name: "Server-side Loopback (127.0.0.1:9000/health)",
      url: `${serverUrl}/health`,
      status: "FAILED",
      details: `Connection failed: ${err.message}. Is Medusa running?`,
    });
  }

  // Test 2: Browser CORS Preflight (OPTIONS request to api.localhost:9000)
  try {
    const corsUrl = `${browserUrl}/store/products`;
    console.log(`[2/3] Testing Browser CORS Preflight: OPTIONS ${corsUrl}...`);
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
        name: "Browser CORS Preflight (api.localhost:9000)",
        url: corsUrl,
        status: "PASSED",
        statusCode: optionsRes.status,
        details: `CORS preflight succeeded. Allow-Origin: ${allowOrigin}`,
      });
    } else {
      results.push({
        name: "Browser CORS Preflight (api.localhost:9000)",
        url: corsUrl,
        status: optionsRes.ok ? "FAILED" : "FAILED",
        statusCode: optionsRes.status,
        details: `CORS header mismatch or failed. Allow-Origin: ${allowOrigin || "None"}, Status: ${optionsRes.status}`,
      });
    }
  } catch (err: any) {
    results.push({
      name: "Browser CORS Preflight (api.localhost:9000)",
      url: `${browserUrl}/store/products`,
      status: "FAILED",
      details: `DNS or network failure: ${err.message}. On Windows 11, check hosts file if api.localhost does not resolve.`,
    });
  }

  // Test 3: Web Storefront SSR Health (localhost:3100)
  try {
    console.log(`[3/3] Testing Web Storefront SSR: ${webUrl}...`);
    const webRes = await fetch(webUrl, { method: "GET" });
    if (webRes.ok) {
      results.push({
        name: "Web Storefront SSR (localhost:3100)",
        url: webUrl,
        status: "PASSED",
        statusCode: webRes.status,
        details: "Storefront HTML rendered and served successfully.",
      });
    } else {
      results.push({
        name: "Web Storefront SSR (localhost:3100)",
        url: webUrl,
        status: "FAILED",
        statusCode: webRes.status,
        details: `Storefront responded with error status: ${webRes.status}`,
      });
    }
  } catch (err: any) {
    results.push({
      name: "Web Storefront SSR (localhost:3100)",
      url: webUrl,
      status: "SKIPPED",
      details: `Web server not reachable at ${webUrl} (${err.message}). Start with 'pnpm dev' or 'pnpm start'.`,
    });
  }

  console.log("\n=================== TEST RESULTS ===================");
  for (const r of results) {
    const icon = r.status === "PASSED" ? "✅" : r.status === "SKIPPED" ? "⚠️" : "❌";
    console.log(`${icon} [${r.status}] ${r.name}`);
    console.log(`   URL: ${r.url}`);
    if (r.statusCode) console.log(`   HTTP Status: ${r.statusCode}`);
    console.log(`   Info: ${r.details}\n`);
  }

  const hasFailures = results.some((r) => r.status === "FAILED");
  if (hasFailures) {
    console.error("⚠️ Some smoke tests failed. Please review the diagnostics above.");
    process.exitCode = 1;
  } else {
    console.log("✨ All active smoke tests passed successfully!");
  }
}

runSmokeTests();
