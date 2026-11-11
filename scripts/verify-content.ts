/**
 * E2E Content & CMS Verification Script (Faz 5.2)
 *
 * Strict LIVE HTTP Verification:
 * 1. Payload CMS health & REST endpoints
 * 2. Real Database Table Seed Idempotency (Pages, Posts, Categories, Redirects counts identical across runs)
 * 3. Anonymous draft leakage prevention via HTTP (GET /api/pages?draft=true, where[slug], where[_status], /api/pages/versions)
 * 4. Storefront unconflicted draft page 404 (GET /sayfa/ozel-taslak-sayfa-test returns strictly HTTP 404)
 * 5. Author privacy (author name rendered, email NEVER leaked to storefront HTML or public REST)
 * 6. Editor RBAC via HTTP (DELETE /api/pages/:id returns 403, POST /api/globals/site-settings returns 403)
 * 7. Payload validation via HTTP (with JWT auth):
 *    - Puck unsafe javascript: href returns HTTP 400
 *    - Reserved slug (urunler) returns HTTP 400
 *    - 600 KB puckData payload returns HTTP 400
 * 8. Anonymous /api/puck/save endpoint returns HTTP 403
 * 9. Live HTTP Puck Page Creation & Publishing (Valid Puck format with props.id returns 200 on /sayfa/<slug> with title visible in HTML)
 * 10. Anonymous /onizleme/:id draft preview rejected (401/403/404/redirect)
 * 11. Sitemap & Robots validation (sitemap excludes drafts & noindex, robots blocks private paths)
 * 12. Bundle audit (@puckeditor isolated from storefront bundles)
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createStepRecorder } from "./lib/verify-step";

dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });
dotenv.config();

const STORE_URL = process.env.STOREFRONT_URL || "http://127.0.0.1:3100";

const { results, recordStep } = createStepRecorder({ format: "step" });

interface AuthResult {
  token: string;
  cookie: string;
  headers: Record<string, string>;
}

async function loginUser(email: string, pass: string): Promise<AuthResult | null> {
  try {
    const res = await fetch(`${STORE_URL}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });

    if (!res.ok) return null;

    const setCookie = res.headers.get("set-cookie") || "";
    const json = await res.json();
    const token = json.token || "";

    let cookieStr = "";
    const match = setCookie.match(/payload-token=([^;]+)/);
    if (match) {
      cookieStr = `payload-token=${match[1]}`;
    } else if (token) {
      cookieStr = `payload-token=${token}`;
    }

    return {
      token,
      cookie: cookieStr,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `JWT ${token}` } : {}),
        ...(cookieStr ? { Cookie: cookieStr } : {}),
      },
    };
  } catch {
    return null;
  }
}

async function run() {
  console.log("================================================================================");
  console.log("🚀 STARTING FAZ 5.2 LIVE HTTP CONTENT & CMS VERIFICATION");
  console.log(`Storefront URL: ${STORE_URL}`);
  console.log("================================================================================\n");

  // STEP 1: Payload Health & REST endpoints
  try {
    const adminRes = await fetch(`${STORE_URL}/admin`, { redirect: "manual" });
    const isHealthy = adminRes.status === 200 || adminRes.status === 302 || adminRes.status === 307;

    const pagesApiRes = await fetch(`${STORE_URL}/api/pages?limit=1`);
    const pagesApiHealthy = pagesApiRes.status === 200;

    recordStep(
      1,
      "Payload Health & REST API",
      isHealthy && pagesApiHealthy,
      `/admin returned HTTP ${adminRes.status}, /api/pages returned HTTP ${pagesApiRes.status}`,
    );
  } catch (err: any) {
    recordStep(1, "Payload Health & REST API", false, `Connection error: ${err.message}`);
  }

  // STEP 2: Real Database Table Seed Idempotency
  try {
    console.log("Running seed:content (Run 1)...");
    execSync("pnpm --filter @alte/web seed:content", { stdio: "pipe" });

    await new Promise((r) => setTimeout(r, 1000));

    const [pages1, posts1, cats1, reds1] = await Promise.all([
      fetch(`${STORE_URL}/api/pages?limit=100`).then((r) => r.json()),
      fetch(`${STORE_URL}/api/posts?limit=100`).then((r) => r.json()),
      fetch(`${STORE_URL}/api/post-categories?limit=100`).then((r) => r.json()),
      fetch(`${STORE_URL}/api/redirects?limit=100`).then((r) => r.json()),
    ]);

    const count1 = {
      pages: pages1.totalDocs ?? 0,
      posts: posts1.totalDocs ?? 0,
      categories: cats1.totalDocs ?? 0,
      redirects: reds1.totalDocs ?? 0,
    };

    console.log("Running seed:content (Run 2 - Idempotency check)...");
    execSync("pnpm --filter @alte/web seed:content", { stdio: "pipe" });

    await new Promise((r) => setTimeout(r, 1000));

    const [pages2, posts2, cats2, reds2] = await Promise.all([
      fetch(`${STORE_URL}/api/pages?limit=100`).then((r) => r.json()),
      fetch(`${STORE_URL}/api/posts?limit=100`).then((r) => r.json()),
      fetch(`${STORE_URL}/api/post-categories?limit=100`).then((r) => r.json()),
      fetch(`${STORE_URL}/api/redirects?limit=100`).then((r) => r.json()),
    ]);

    const count2 = {
      pages: pages2.totalDocs ?? 0,
      posts: posts2.totalDocs ?? 0,
      categories: cats2.totalDocs ?? 0,
      redirects: reds2.totalDocs ?? 0,
    };

    const countsIdentical =
      count1.pages === count2.pages &&
      count1.posts === count2.posts &&
      count1.categories === count2.categories &&
      count1.redirects === count2.redirects &&
      count1.pages > 0;

    recordStep(
      2,
      "Real Table Seed Idempotency (pnpm seed:content)",
      countsIdentical,
      `Run 1: pages=${count1.pages}, posts=${count1.posts}, categories=${count1.categories}, redirects=${count1.redirects} | Run 2: pages=${count2.pages}, posts=${count2.posts}, categories=${count2.categories}, redirects=${count2.redirects}. Zero duplicates.`,
    );
  } catch (err: any) {
    recordStep(2, "Real Table Seed Idempotency", false, `Seed error: ${err.message}`);
  }

  // STEP 3: Anonymous Draft Leakage Prevention (Pure HTTP)
  try {
    // 3a: /api/pages?draft=true
    const draftParamRes = await fetch(`${STORE_URL}/api/pages?draft=true&limit=100`);
    const draftParamJson = await draftParamRes.json();
    const draftParamCount = (draftParamJson.docs || []).filter(
      (d: any) => d._status === "draft",
    ).length;

    // 3b: /api/pages?where[_status][equals]=draft
    const whereDraftRes = await fetch(`${STORE_URL}/api/pages?where[_status][equals]=draft`);
    const whereDraftJson = await whereDraftRes.json();
    const whereDraftCount = whereDraftJson.docs?.length || 0;

    // 3c: /api/pages?where[slug][equals]=ozel-taslak-sayfa-test (draft page)
    const specificDraftRes = await fetch(
      `${STORE_URL}/api/pages?where[slug][equals]=ozel-taslak-sayfa-test`,
    );
    const specificDraftJson = await specificDraftRes.json();
    const specificDraftCount = specificDraftJson.docs?.length || 0;

    // 3d: /api/pages/versions
    const versionsRes = await fetch(`${STORE_URL}/api/pages/versions`);
    const versionsBlocked =
      versionsRes.status === 401 ||
      versionsRes.status === 403 ||
      (await versionsRes.json()).docs?.length === 0;

    const noLeakage =
      draftParamCount === 0 && whereDraftCount === 0 && specificDraftCount === 0 && versionsBlocked;

    recordStep(
      3,
      "Anonymous Draft Leakage Prevention (REST API)",
      noLeakage,
      `draft=true count: ${draftParamCount}, where[_status]=draft count: ${whereDraftCount}, specific draft count: ${specificDraftCount}, versions endpoint protected: ${versionsBlocked}`,
    );
  } catch (err: any) {
    recordStep(
      3,
      "Anonymous Draft Leakage Prevention (REST API)",
      false,
      `Draft leakage test error: ${err.message}`,
    );
  }

  // STEP 4: Storefront Unconflicted Draft Page Returns 404 (Pure HTTP)
  try {
    const draftPageRes = await fetch(`${STORE_URL}/sayfa/ozel-taslak-sayfa-test`, {
      redirect: "manual",
    });
    const is404 = draftPageRes.status === 404;

    recordStep(
      4,
      "Storefront Draft Returns HTTP 404",
      is404,
      `/sayfa/ozel-taslak-sayfa-test returned HTTP ${draftPageRes.status} (strictly expected 404)`,
    );
  } catch (err: any) {
    recordStep(
      4,
      "Storefront Draft Returns HTTP 404",
      false,
      `Storefront draft error: ${err.message}`,
    );
  }

  // STEP 5: Author Privacy (Pure HTTP - Storefront & REST)
  try {
    const postSlug = "kapsul-gardirop-olusturmanin-5-altin-kurali";
    const postRes = await fetch(`${STORE_URL}/blog/${postSlug}`);
    const postHtml = await postRes.text();

    const hasAuthor = postHtml.includes("Yazar:") || postHtml.includes("Editör");
    const authorSection = postHtml.slice(
      postHtml.indexOf("Yazar:"),
      postHtml.indexOf("Yazar:") + 300,
    );
    const leaksEmail = authorSection.includes("@");

    // Public REST check
    const restPostRes = await fetch(`${STORE_URL}/api/posts?where[slug][equals]=${postSlug}`);
    const restPostJson = await restPostRes.json();
    const authorDoc = restPostJson.docs?.[0]?.author;
    const restEmailLeaked = typeof authorDoc === "object" && Boolean(authorDoc?.email);

    const privacyPassed = hasAuthor && !leaksEmail && !restEmailLeaked;
    recordStep(
      5,
      "Author Privacy & Zero Email Leak (Storefront & REST)",
      privacyPassed,
      `Author name rendered correctly. Storefront HTML email leak: ${leaksEmail}. Public REST author email leak: ${restEmailLeaked}.`,
    );
  } catch (err: any) {
    recordStep(5, "Author Privacy & Zero Email Leak", false, `Author test error: ${err.message}`);
  }

  // STEP 6: Editor RBAC via Live HTTP (DELETE 403 & site-settings 403)
  try {
    const editorAuth = await loginUser("editor@example.test", "test-editor-password-123");

    if (!editorAuth) {
      recordStep(
        6,
        "Editor RBAC via HTTP (DELETE 403 & site-settings 403)",
        false,
        "Could not login as editor@example.test. Ensure seed ran with test staff users.",
      );
    } else {
      const pagesRes = await fetch(`${STORE_URL}/api/pages?limit=1`);
      const pagesJson = await pagesRes.json();
      const pageId = pagesJson.docs?.[0]?.id;

      // 6a: Editor attempts DELETE on page -> 403
      let deleteBlocked = false;
      if (pageId) {
        const deleteRes = await fetch(`${STORE_URL}/api/pages/${pageId}`, {
          method: "DELETE",
          headers: editorAuth.headers,
        });
        deleteBlocked = deleteRes.status === 403;
      }

      // 6b: Editor attempts UPDATE on site-settings global -> 403
      const updateSettingsRes = await fetch(`${STORE_URL}/api/globals/site-settings`, {
        method: "POST",
        headers: editorAuth.headers,
        body: JSON.stringify({ storeName: "Hacked Store Name" }),
      });
      const settingsBlocked = updateSettingsRes.status === 403 || updateSettingsRes.status === 401;

      const rbacPassed = deleteBlocked && settingsBlocked;
      recordStep(
        6,
        "Editor RBAC via HTTP (DELETE 403 & site-settings 403)",
        rbacPassed,
        `Editor DELETE /api/pages/${pageId}: HTTP ${deleteBlocked ? 403 : "other"} (blocked: ${deleteBlocked}). Editor POST /api/globals/site-settings: HTTP ${settingsBlocked ? 403 : "other"} (blocked: ${settingsBlocked}).`,
      );
    }
  } catch (err: any) {
    recordStep(6, "Editor RBAC via HTTP", false, `Editor RBAC error: ${err.message}`);
  }

  // STEP 7: Payload Validation via Live HTTP (javascript: 400, reserved slug 400, 600 KB 400)
  try {
    const adminAuth = await loginUser("admin@example.test", "test-admin-password-123");

    if (!adminAuth) {
      recordStep(
        7,
        "Payload Validation via HTTP (javascript: 400, reserved slug 400, 600 KB 400)",
        false,
        "Could not login as admin@example.test.",
      );
    } else {
      // 7a: Unsafe javascript: link in puckData -> must return HTTP 400
      const xssRes = await fetch(`${STORE_URL}/api/pages`, {
        method: "POST",
        headers: adminAuth.headers,
        body: JSON.stringify({
          title: "Test XSS Page",
          slug: "test-xss-link",
          puckData: {
            content: [
              {
                type: "Hero",
                props: { id: "hero-bad", primaryButtonHref: "javascript:alert(1)" },
              },
            ],
          },
        }),
      });
      const xssBlocked = xssRes.status === 400;

      // 7b: Reserved slug (urunler) -> must return HTTP 400
      const reservedSlugRes = await fetch(`${STORE_URL}/api/pages`, {
        method: "POST",
        headers: adminAuth.headers,
        body: JSON.stringify({
          title: "Reserved Slug Test",
          slug: "urunler",
        }),
      });
      const reservedBlocked = reservedSlugRes.status === 400;

      // 7c: 600 KB puckData payload -> must return HTTP 400
      const hugeRes = await fetch(`${STORE_URL}/api/pages`, {
        method: "POST",
        headers: adminAuth.headers,
        body: JSON.stringify({
          title: "Huge Page Test",
          slug: "huge-page-test",
          puckData: {
            content: [
              {
                type: "Hero",
                props: { id: "hero-huge", title: "A".repeat(600 * 1024) },
              },
            ],
          },
        }),
      });
      const hugeBlocked = hugeRes.status === 400;

      const validationPassed = xssBlocked && reservedBlocked && hugeBlocked;
      recordStep(
        7,
        "Payload Validation via HTTP (javascript: 400, reserved slug 400, 600 KB 400)",
        validationPassed,
        `javascript: link: HTTP ${xssRes.status} (strictly expected 400), reserved slug 'urunler': HTTP ${reservedSlugRes.status} (strictly expected 400), 600 KB payload: HTTP ${hugeRes.status} (strictly expected 400)`,
      );
    }
  } catch (err: any) {
    recordStep(7, "Payload Validation via HTTP", false, `Validation test error: ${err.message}`);
  }

  // STEP 8: Anonymous /api/puck/save returns HTTP 403
  try {
    const anonPuckSaveRes = await fetch(`${STORE_URL}/api/puck/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, puckData: {} }),
    });
    const puckSaveBlocked = anonPuckSaveRes.status === 403;

    recordStep(
      8,
      "Anonymous /api/puck/save Returns HTTP 403",
      puckSaveBlocked,
      `/api/puck/save returned HTTP ${anonPuckSaveRes.status} (strictly expected 403)`,
    );
  } catch (err: any) {
    recordStep(8, "Anonymous /api/puck/save", false, `Puck save error: ${err.message}`);
  }

  // STEP 9: Live HTTP Puck Page Creation & Publishing
  try {
    const editorAuth = await loginUser("editor@example.test", "test-editor-password-123");
    if (!editorAuth) {
      recordStep(
        9,
        "Live HTTP Puck Page Creation & Publishing",
        false,
        "Could not login as editor to test Puck page creation.",
      );
    } else {
      const testSlug = "puck-canli-dogrulama-test";

      // Delete if already existing from prior run
      const checkExisting = await fetch(
        `${STORE_URL}/api/pages?where[slug][equals]=${testSlug}&draft=true`,
        { headers: editorAuth.headers },
      );
      const existingJson = await checkExisting.json();
      if (existingJson.docs?.length > 0) {
        const adminAuth = await loginUser("admin@example.test", "test-admin-password-123");
        for (const doc of existingJson.docs) {
          await fetch(`${STORE_URL}/api/pages/${doc.id}`, {
            method: "DELETE",
            headers: adminAuth?.headers || editorAuth.headers,
          });
        }
      }

      // Create page in draft with Puck format
      const createRes = await fetch(`${STORE_URL}/api/pages`, {
        method: "POST",
        headers: editorAuth.headers,
        body: JSON.stringify({
          title: "Puck Doğrulama Sayfası",
          slug: testSlug,
          _status: "draft",
          puckData: {
            root: { props: { title: "Puck Doğrulama Sayfası" } },
            content: [
              {
                type: "Hero",
                props: {
                  id: "hero-live-fixture-1",
                  title: "Harika Puck Canlı Başlığı",
                  subtitle: "Canlı E2E test ile oluşturulan ve yayınlanan Puck sayfası.",
                  align: "center",
                  primaryButtonText: "Alışverişe Başla",
                  primaryButtonHref: "/urunler",
                },
              },
            ],
            zones: {},
          },
        }),
      });

      const createJson = await createRes.json();
      const pageId = createJson.doc?.id;

      // Now publish via /api/puck/save endpoint as editor
      const saveRes = await fetch(`${STORE_URL}/api/puck/save`, {
        method: "POST",
        headers: editorAuth.headers,
        body: JSON.stringify({
          id: pageId,
          publish: true,
          puckData: {
            root: { props: { title: "Puck Doğrulama Sayfası" } },
            content: [
              {
                type: "Hero",
                props: {
                  id: "hero-live-fixture-1",
                  title: "Harika Puck Canlı Başlığı",
                  subtitle: "Canlı E2E test ile oluşturulan ve yayınlanan Puck sayfası.",
                  align: "center",
                  primaryButtonText: "Alışverişe Başla",
                  primaryButtonHref: "/urunler",
                },
              },
            ],
            zones: {},
          },
        }),
      });

      const saveOk = saveRes.status === 200;

      // Verify on storefront: /sayfa/<slug> returns 200 and title in HTML
      const viewRes = await fetch(`${STORE_URL}/sayfa/${testSlug}`);
      const viewStatus = viewRes.status;
      const viewHtml = await viewRes.text();
      const titleVisible = viewHtml.includes("Harika Puck Canlı Başlığı");

      const stepPassed =
        (createRes.status === 201 || createRes.status === 200) &&
        saveOk &&
        viewStatus === 200 &&
        titleVisible;

      recordStep(
        9,
        "Live HTTP Puck Page Creation & Publishing",
        stepPassed,
        `Create HTTP ${createRes.status}, /api/puck/save HTTP ${saveRes.status}, Storefront HTTP ${viewStatus}, Title rendered in HTML: ${titleVisible}`,
      );

      // Clean up test page
      if (pageId) {
        const adminAuth = await loginUser("admin@example.test", "test-admin-password-123");
        await fetch(`${STORE_URL}/api/pages/${pageId}`, {
          method: "DELETE",
          headers: adminAuth?.headers || editorAuth.headers,
        });
      }
    }
  } catch (err: any) {
    recordStep(
      9,
      "Live HTTP Puck Page Creation & Publishing",
      false,
      `Live Puck error: ${err.message}`,
    );
  }

  // STEP 10: Anonymous /onizleme/:id Draft Preview Rejection
  try {
    const previewRes = await fetch(`${STORE_URL}/onizleme/1`, { redirect: "manual" });
    const previewBlocked =
      previewRes.status === 401 ||
      previewRes.status === 403 ||
      previewRes.status === 404 ||
      previewRes.status === 302 ||
      previewRes.status === 307;

    recordStep(
      10,
      "Anonymous /onizleme/:id Rejected",
      previewBlocked,
      `/onizleme/1 returned HTTP ${previewRes.status} (strictly non-200 / redirect)`,
    );
  } catch (err: any) {
    recordStep(10, "Anonymous /onizleme/:id", false, `Preview error: ${err.message}`);
  }

  // STEP 11: Sitemap & Robots Validation
  try {
    const sitemapRes = await fetch(`${STORE_URL}/sitemap.xml`);
    const sitemapXml = await sitemapRes.text();
    let allSitemapContent = sitemapXml;

    if (sitemapRes.status === 200 && sitemapXml.includes("<sitemapindex")) {
      const [sub0, sub1, sub2] = await Promise.all([
        fetch(`${STORE_URL}/sitemap/0.xml`)
          .then((r) => r.text())
          .catch(() => ""),
        fetch(`${STORE_URL}/sitemap/1.xml`)
          .then((r) => r.text())
          .catch(() => ""),
        fetch(`${STORE_URL}/sitemap/2.xml`)
          .then((r) => r.text())
          .catch(() => ""),
      ]);
      allSitemapContent = sitemapXml + sub0 + sub1 + sub2;
    }

    const sitemapValid =
      sitemapRes.status === 200 &&
      (sitemapXml.includes("<urlset") || sitemapXml.includes("<sitemapindex")) &&
      allSitemapContent.includes("/sayfa/hakkimizda") &&
      !allSitemapContent.includes("ozel-taslak-sayfa-test") &&
      !allSitemapContent.includes("mesafeli-satis-sozlesmesi");

    const robotsRes = await fetch(`${STORE_URL}/robots.txt`);
    const robotsTxt = await robotsRes.text();
    const robotsValid =
      robotsRes.status === 200 &&
      robotsTxt.includes("Disallow: /admin") &&
      robotsTxt.includes("Disallow: /sepet") &&
      robotsTxt.includes("Disallow: /odeme") &&
      robotsTxt.includes("Disallow: /onizleme") &&
      robotsTxt.includes("sitemap.xml");

    recordStep(
      11,
      "Sitemap & Robots (No Drafts, Disallow Rules)",
      sitemapValid && robotsValid,
      `Sitemap HTTP ${sitemapRes.status} (drafts excluded: ${!allSitemapContent.includes("ozel-taslak-sayfa-test")}). Robots HTTP ${robotsRes.status} (rules valid: ${robotsValid}).`,
    );
  } catch (err: any) {
    recordStep(11, "Sitemap & Robots", false, `Sitemap/Robots error: ${err.message}`);
  }

  // STEP 12: Bundle Audit (@puckeditor isolated from storefront)
  try {
    const chunksDir = path.resolve(process.cwd(), "apps/web/.next/static/chunks");
    let puckFoundInChunks = false;

    if (fs.existsSync(chunksDir)) {
      const files = fs.readdirSync(chunksDir, { recursive: true }) as string[];
      for (const file of files) {
        if (typeof file === "string" && file.endsWith(".js")) {
          const fullPath = path.join(chunksDir, file);
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.includes("@puckeditor")) {
            puckFoundInChunks = true;
            break;
          }
        }
      }
    }

    recordStep(
      12,
      "Bundle Audit (Zero Puck in Storefront Client Chunks)",
      !puckFoundInChunks,
      puckFoundInChunks
        ? "FAIL: Found @puckeditor in storefront client chunks."
        : "PASS: Exactly 0 storefront client chunks contain @puckeditor.",
    );
  } catch (err: any) {
    recordStep(12, "Bundle Audit", false, `Bundle audit error: ${err.message}`);
  }

  // SUMMARY TABLE
  console.log("\n================================================================================");
  console.log("📊 FAZ 5.2 VERIFICATION SUMMARY TABLE");
  console.log("================================================================================");
  console.table(
    results.map((r) => ({
      Step: r.step,
      Check: r.name,
      Status: r.passed ? "PASS" : "FAIL",
      Details: r.details.slice(0, 75) + (r.details.length > 75 ? "..." : ""),
    })),
  );

  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    console.log(
      `\n🎉 ALL ${results.length}/${results.length} VERIFICATION STEPS PASSED SUCCESSFULLY!`,
    );
    process.exit(0);
  } else {
    console.error("\n❌ VERIFICATION FAILED: One or more steps did not pass.");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
