import type { StoreProduct } from "./medusa/types";

export const INFINITE_GRID_STORAGE_PREFIX = "alte:infinite-grid:";
export const INFINITE_GRID_TTL_MS = 30 * 60 * 1000;
const POPSTATE_WINDOW_MS = 2000;

export interface InfiniteGridSnapshot {
  products: StoreProduct[];
  page: number;
  hasMore: boolean;
  autoLoadLimit: number;
  scrollY: number;
  category?: string;
  sort?: "created_at" | "price_asc" | "price_desc";
  limit: number;
  savedAt: number;
}

export interface InfiniteGridMatchCriteria {
  category?: string;
  sort?: "created_at" | "price_asc" | "price_desc";
  limit: number;
  initialFirstId?: string;
}

let lastPopStateAt: number | null = null;
let listenerInitialized = false;
let consumedPerfBackForward = false;

export function buildInfiniteGridStorageKey(pathname: string, search = ""): string {
  return `${INFINITE_GRID_STORAGE_PREFIX}${pathname}${search}`;
}

export function markBackNavigation(now: number = Date.now()): void {
  lastPopStateAt = now;
}

export function markForwardNavigation(): void {
  lastPopStateAt = null;
}

export function initBackNavigationListener(): void {
  if (typeof window === "undefined" || listenerInitialized) return;
  listenerInitialized = true;
  window.addEventListener("popstate", () => {
    markBackNavigation();
  });
  window.addEventListener(
    "click",
    () => {
      markForwardNavigation();
    },
    true,
  );
}

function getNavigationEntryType(): string | undefined {
  if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
    return undefined;
  }
  const entry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  return entry?.type;
}

/**
 * Returns true if the current navigation arrived via browser Back/Forward
 * (either SPA popstate within the grace window or full-load back_forward).
 * StrictMode double-invocations and RSC stream updates within the window
 * both observe true; any user click clears the popstate signal.
 */
export function consumeBackNavigation(
  now: number = Date.now(),
  navType: string | undefined = getNavigationEntryType(),
): boolean {
  if (lastPopStateAt !== null) {
    const isRecent = now >= lastPopStateAt && now - lastPopStateAt <= POPSTATE_WINDOW_MS;
    if (isRecent) {
      return true;
    }
    lastPopStateAt = null;
  }

  if (!consumedPerfBackForward && navType === "back_forward") {
    consumedPerfBackForward = true;
    return true;
  }

  return false;
}

export function resetBackNavigationForTest(): void {
  lastPopStateAt = null;
  consumedPerfBackForward = false;
}

export function getBrowserSessionStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function saveInfiniteGridSnapshot(
  storage: Storage | undefined,
  key: string,
  snapshot: Omit<InfiniteGridSnapshot, "savedAt">,
  now: number = Date.now(),
): void {
  if (!storage) return;
  try {
    const payload: InfiniteGridSnapshot = {
      ...snapshot,
      savedAt: now,
    };
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private-mode access errors
  }
}

export function loadInfiniteGridSnapshot(
  storage: Storage | undefined,
  key: string,
  expected: InfiniteGridMatchCriteria,
  now: number = Date.now(),
): InfiniteGridSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<InfiniteGridSnapshot>;
    if (
      !parsed ||
      typeof parsed.savedAt !== "number" ||
      !Number.isFinite(parsed.savedAt) ||
      now < parsed.savedAt ||
      now - parsed.savedAt > INFINITE_GRID_TTL_MS
    ) {
      return null;
    }

    if (
      parsed.category !== expected.category ||
      parsed.sort !== expected.sort ||
      parsed.limit !== expected.limit
    ) {
      return null;
    }

    if (
      !Array.isArray(parsed.products) ||
      parsed.products.length === 0 ||
      typeof parsed.page !== "number" ||
      parsed.page < 1 ||
      typeof parsed.hasMore !== "boolean" ||
      typeof parsed.autoLoadLimit !== "number" ||
      typeof parsed.scrollY !== "number" ||
      parsed.scrollY < 0
    ) {
      return null;
    }

    if (expected.initialFirstId && parsed.products[0]?.id !== expected.initialFirstId) {
      return null;
    }

    return parsed as InfiniteGridSnapshot;
  } catch {
    return null;
  }
}

export function clearInfiniteGridSnapshot(storage: Storage | undefined, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage access errors
  }
}

if (typeof window !== "undefined") {
  initBackNavigationListener();
}
