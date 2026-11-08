import { isSafeHref } from "./safe-href";

export interface RedirectRecord {
  from: string;
  to: string;
  type?: "301" | "302";
}

/**
 * Normalizes redirect paths:
 * - Lowercases path
 * - Strips trailing slashes (except root '/')
 * - Trims whitespace
 */
export function normalizeRedirectPath(urlPath: string): string {
  let normalized = urlPath.trim();
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }

  // Remove trailing slashes if longer than 1 character
  while (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.toLowerCase();
}

/**
 * Validates from/to redirect endpoints:
 * - 'from' must be an internal path starting with '/'
 * - 'to' must be a safe internal path or safe 'https://' URL
 * - 'from' cannot equal 'to' (self-loop prevention)
 */
export function validateRedirectEndpoints(from: string, to: string): {
  valid: boolean;
  error?: string;
  normalizedFrom: string;
  normalizedTo: string;
} {
  const trimmedFrom = (from || "").trim();
  const trimmedTo = (to || "").trim();

  if (!trimmedFrom.startsWith("/") || trimmedFrom.startsWith("//")) {
    return {
      valid: false,
      error: "'from' yolu tek bir '/' ile başlamalıdır.",
      normalizedFrom: trimmedFrom,
      normalizedTo: trimmedTo,
    };
  }

  // 'to' must strictly be a valid safe href (either '/' internal or 'https://' external)
  if (!isSafeHref(trimmedTo)) {
    return {
      valid: false,
      error: "'to' hedefi güvenli bir iç yol ('/...') veya güvenli 'https://' adresi olmalıdır.",
      normalizedFrom: trimmedFrom,
      normalizedTo: trimmedTo,
    };
  }

  const normFrom = normalizeRedirectPath(trimmedFrom);
  const normTo = trimmedTo.startsWith("https://") ? trimmedTo : normalizeRedirectPath(trimmedTo);

  if (normFrom === normTo) {
    return {
      valid: false,
      error: "Kendi kendine yönlendirme yapılamaz ('from' ve 'to' aynı olamaz).",
      normalizedFrom: normFrom,
      normalizedTo: normTo,
    };
  }

  return {
    valid: true,
    normalizedFrom: normFrom,
    normalizedTo: normTo,
  };
}

/**
 * Checks if adding a new redirect (from -> to) creates a circular loop with existing redirects.
 * Traces chain: to -> next -> next...
 * Returns true if a loop is detected.
 */
export function isCircularRedirect(
  newFrom: string,
  newTo: string,
  existingRedirects: RedirectRecord[],
  maxDepth = 10,
): boolean {
  const normFrom = normalizeRedirectPath(newFrom);
  let currentTarget = newTo.startsWith("https://") ? newTo.trim() : normalizeRedirectPath(newTo);

  const redirectMap = new Map<string, string>();
  for (const r of existingRedirects) {
    redirectMap.set(normalizeRedirectPath(r.from), normalizeRedirectPath(r.to));
  }

  const visited = new Set<string>();
  visited.add(normFrom);

  let depth = 0;
  while (depth < maxDepth) {
    if (currentTarget.startsWith("https://")) {
      // External redirect cannot loop back into internal redirects
      return false;
    }

    if (visited.has(currentTarget)) {
      return true; // Loop detected!
    }

    visited.add(currentTarget);
    const nextTarget = redirectMap.get(currentTarget);
    if (!nextTarget) {
      break;
    }
    currentTarget = nextTarget;
    depth++;
  }

  return false;
}
