declare const __BACKEND_URL__: string | undefined;

/**
 * Resolves Medusa Admin API paths so custom admin routes work both when served
 * behind Next.js `/app` (`/medusa-api/*` proxy) and directly on Medusa `:9000`.
 */
export function adminApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const rawBase = typeof __BACKEND_URL__ === "string" ? __BACKEND_URL__.replace(/\/+$/, "") : "";
  if (rawBase && rawBase !== "/") {
    return `${rawBase}${normalized}`;
  }
  if (typeof window !== "undefined" && window.location.port !== "9000") {
    return `/medusa-api${normalized}`;
  }
  return normalized;
}
