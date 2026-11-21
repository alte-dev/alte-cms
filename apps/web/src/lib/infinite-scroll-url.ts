export const INFINITE_SCROLL_KEY_PREFIX = "alte:infinite-scroll:";
export const INFINITE_SCROLL_TTL_MS = 30 * 60 * 1000;
const POPSTATE_WINDOW_MS = 30 * 1000;

let lastPopStateAt: number | null = null;
let listenerInitialized = false;
let consumedPerfBackForward = false;

export function buildInfinitePagesUrl(pathname: string, search: string, pages: number): string {
  const params = new URLSearchParams(search);
  if (pages > 1) {
    params.set("pages", String(pages));
  } else {
    params.delete("pages");
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function buildInfiniteScrollKey(pathname: string, search = ""): string {
  return `${INFINITE_SCROLL_KEY_PREFIX}${pathname}${search}`;
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
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("a[href]")) {
        markForwardNavigation();
      }
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

export function consumeBackNavigation(
  now: number = Date.now(),
  navType: string | undefined = getNavigationEntryType(),
): boolean {
  if (lastPopStateAt !== null) {
    const isRecent = now >= lastPopStateAt && now - lastPopStateAt <= POPSTATE_WINDOW_MS;
    if (isRecent) return true;
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

export function saveInfiniteScrollY(
  storage: Storage | undefined,
  key: string,
  scrollY: number,
  now: number = Date.now(),
): void {
  if (!storage || !Number.isFinite(scrollY) || scrollY < 0) return;
  try {
    storage.setItem(key, JSON.stringify({ scrollY, savedAt: now }));
  } catch {
    // Ignore quota or private-mode errors
  }
}

export function loadInfiniteScrollY(
  storage: Storage | undefined,
  key: string,
  now: number = Date.now(),
): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { scrollY?: unknown; savedAt?: unknown };
    if (
      typeof parsed.scrollY !== "number" ||
      !Number.isFinite(parsed.scrollY) ||
      parsed.scrollY < 0 ||
      typeof parsed.savedAt !== "number" ||
      now < parsed.savedAt ||
      now - parsed.savedAt > INFINITE_SCROLL_TTL_MS
    ) {
      return null;
    }
    return parsed.scrollY;
  } catch {
    return null;
  }
}

export function clearInfiniteScrollY(storage: Storage | undefined, key: string): void {
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
