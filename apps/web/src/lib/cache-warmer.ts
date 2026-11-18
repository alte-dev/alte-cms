import { revalidatePath } from "next/cache";
import { CACHE_TAGS, revalidateContentTag } from "./cache-tags";

export interface CacheWarmSummary {
  status: "idle" | "running" | "completed" | "failed";
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  totalUrls: number;
  scanned: number;
  succeeded: number;
  failed: number;
  skipped: number;
  error?: string;
}

const NON_CACHEABLE_PREFIXES = [
  "/sepet",
  "/odeme",
  "/hesap",
  "/siparis-onay",
  "/siparis-takip",
  "/onizleme",
  "/admin",
  "/app",
  "/api",
  "/medusa-api",
  "/ara",
];

const MAX_WARM_URLS = 500;
const DEFAULT_CONCURRENCY = 2;
const REQUEST_TIMEOUT_MS = 10_000;

let lastWarmSummary: CacheWarmSummary = {
  status: "idle",
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  totalUrls: 0,
  scanned: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
};

export function getLastWarmSummary(): CacheWarmSummary {
  return { ...lastWarmSummary };
}

export function isWarmRunning(): boolean {
  return lastWarmSummary.status === "running";
}

export function resetWarmStateForTests(): void {
  lastWarmSummary = {
    status: "idle",
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    totalUrls: 0,
    scanned: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };
}

/**
 * Returns true for routes that must NEVER be cached or pre-warmed
 * (cart, checkout, customer account, order confirmation/tracking, preview, admin, APIs, search).
 */
export function isNonCacheablePath(pathname: string): boolean {
  const normalized = pathname.trim().toLowerCase();
  if (!normalized.startsWith("/")) {
    return true;
  }
  return NON_CACHEABLE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

/**
 * Extracts <loc> URLs from a sitemap or sitemapindex XML string.
 */
export function extractLocUrlsFromXml(xml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    if (match[1]) {
      urls.push(match[1].trim());
    }
  }
  return urls;
}

function rewriteToBaseOrigin(
  rawUrl: string,
  baseUrl: string,
): { url: string; pathname: string } | null {
  try {
    const base = new URL(baseUrl);
    const parsed = new URL(rawUrl, base);
    const target = new URL(parsed.pathname + parsed.search, base);
    return { url: target.toString(), pathname: parsed.pathname };
  } catch {
    return null;
  }
}

export async function collectWarmableUrls(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ urls: string[]; skipped: number }> {
  const rootRes = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/sitemap.xml`, {
    cache: "no-store",
    headers: { "User-Agent": "Alte-CacheWarmer/1.0" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!rootRes.ok) {
    throw new Error(`Sitemap okunamadı (HTTP ${rootRes.status})`);
  }

  const rootXml = await rootRes.text();
  const rootLocs = extractLocUrlsFromXml(rootXml);
  const isIndex = /<sitemapindex[\s>]/i.test(rootXml);

  const candidateUrls: string[] = [];
  if (isIndex) {
    for (const childLoc of rootLocs) {
      const rewritten = rewriteToBaseOrigin(childLoc, baseUrl);
      if (!rewritten) continue;
      const childRes = await fetchImpl(rewritten.url, {
        cache: "no-store",
        headers: { "User-Agent": "Alte-CacheWarmer/1.0" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!childRes.ok) continue;
      const childXml = await childRes.text();
      candidateUrls.push(...extractLocUrlsFromXml(childXml));
    }
  } else {
    candidateUrls.push(...rootLocs);
  }

  const seen = new Set<string>();
  const urls: string[] = [];
  let skipped = 0;

  for (const raw of candidateUrls) {
    const rewritten = rewriteToBaseOrigin(raw, baseUrl);
    if (!rewritten) {
      skipped += 1;
      continue;
    }
    if (isNonCacheablePath(rewritten.pathname)) {
      skipped += 1;
      continue;
    }
    if (seen.has(rewritten.url)) {
      continue;
    }
    seen.add(rewritten.url);
    urls.push(rewritten.url);
    if (urls.length >= MAX_WARM_URLS) {
      break;
    }
  }

  return { urls, skipped };
}

export function getInternalWebBaseUrl(): string {
  const port = process.env.PORT || "3100";
  return (process.env.INTERNAL_WEB_URL || `http://127.0.0.1:${port}`).replace(/\/+$/, "");
}

/**
 * Warms public storefront pages listed in sitemap.xml with bounded concurrency.
 */
export async function warmStorefrontCache(options?: {
  baseUrl?: string;
  concurrency?: number;
  fetchImpl?: typeof fetch;
}): Promise<CacheWarmSummary> {
  if (isWarmRunning()) {
    return getLastWarmSummary();
  }

  const baseUrl = (options?.baseUrl || getInternalWebBaseUrl()).replace(/\/+$/, "");
  const concurrency = Math.max(1, Math.min(4, options?.concurrency ?? DEFAULT_CONCURRENCY));
  const fetchImpl = options?.fetchImpl || fetch;
  const startedMs = Date.now();

  lastWarmSummary = {
    status: "running",
    startedAt: new Date(startedMs).toISOString(),
    finishedAt: null,
    durationMs: null,
    totalUrls: 0,
    scanned: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    const { urls, skipped } = await collectWarmableUrls(baseUrl, fetchImpl);
    lastWarmSummary.totalUrls = urls.length;
    lastWarmSummary.skipped = skipped;

    let cursor = 0;
    const worker = async () => {
      while (cursor < urls.length) {
        const currentUrl = urls[cursor++];
        if (!currentUrl) break;
        try {
          const res = await fetchImpl(currentUrl, {
            method: "GET",
            cache: "no-store",
            headers: { "User-Agent": "Alte-CacheWarmer/1.0" },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          });
          await res.body?.cancel().catch(() => {});
          lastWarmSummary.scanned += 1;
          if (res.ok) {
            lastWarmSummary.succeeded += 1;
          } else {
            lastWarmSummary.failed += 1;
          }
        } catch {
          lastWarmSummary.scanned += 1;
          lastWarmSummary.failed += 1;
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, Math.max(1, urls.length)) }, () =>
      worker(),
    );
    await Promise.all(workers);

    const finishedMs = Date.now();
    lastWarmSummary.status = "completed";
    lastWarmSummary.finishedAt = new Date(finishedMs).toISOString();
    lastWarmSummary.durationMs = finishedMs - startedMs;
    return getLastWarmSummary();
  } catch (err) {
    const finishedMs = Date.now();
    lastWarmSummary.status = "failed";
    lastWarmSummary.finishedAt = new Date(finishedMs).toISOString();
    lastWarmSummary.durationMs = finishedMs - startedMs;
    lastWarmSummary.error = err instanceof Error ? err.message : "Önbellek ısıtma başarısız oldu.";
    return getLastWarmSummary();
  }
}

/**
 * Purges all storefront cache tags and root layout path.
 */
export function purgeAllStorefrontCache(): {
  purged: true;
  tags: string[];
  timestamp: number;
} {
  const tags: string[] = [
    CACHE_TAGS.products,
    CACHE_TAGS.categories,
    CACHE_TAGS.blog,
    CACHE_TAGS.pages,
    CACHE_TAGS.navigation,
    CACHE_TAGS.settings,
    CACHE_TAGS.sitemap,
  ];

  for (const tag of tags) {
    revalidateContentTag(tag);
  }

  try {
    revalidatePath("/", "layout");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (!msg.includes("static generation store missing")) {
      throw err;
    }
  }

  return {
    purged: true,
    tags,
    timestamp: Date.now(),
  };
}
