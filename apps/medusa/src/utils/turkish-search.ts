/**
 * Turkish Search Normalization & Query Sanitization Utilities
 *
 * Handles:
 * - Turkish dotted/dotless I/ı/İ/i case folding
 * - Unaccent & diacritic phonetic normalization (ç/c, ğ/g, ö/o, ş/s, ü/u)
 * - Safe LIKE wildcard escaping (%, _, \)
 * - Query length validation (min 2, max 100)
 * - In-memory IP-based rate limiting (60 requests per minute)
 */

/**
 * Normalizes Turkish text for fuzzy matching.
 * Converts I/ı/İ/i, ç/c, ğ/g, ö/o, ş/s, ü/u to ASCII equivalents
 * so that "Işık", "ışık", and "isik" match the same entity,
 * and "İpek" and "ipek" match seamlessly.
 */
export function normalizeTurkishText(text: string): string {
  if (!text) return "";
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .trim();
}

/**
 * Escapes PostgreSQL LIKE/ILIKE special wildcard characters (%, _, \).
 */
export function escapeLikeWildcards(text: string): string {
  if (!text) return "";
  return text.replace(/[%_\\]/g, "\\$&");
}

export interface SearchQueryValidationResult {
  valid: boolean;
  sanitized: string;
  error?: string;
}

/**
 * Validates and sanitizes raw user search query string.
 * Enforces:
 * - Minimum length: 2 characters (after trimming)
 * - Maximum length: 100 characters
 * - Strips control characters
 */
export function validateSearchQuery(raw: unknown): SearchQueryValidationResult {
  if (typeof raw !== "string") {
    return {
      valid: false,
      sanitized: "",
      error: "Arama terimi zorunludur ve metin formatında olmalıdır.",
    };
  }

  // Remove control characters (ASCII 0-31, 127)
  const cleaned = raw.replace(/[\x00-\x1F\x7F]/g, "").trim();

  if (cleaned.length < 2) {
    return {
      valid: false,
      sanitized: cleaned,
      error: "Arama sorgusu en az 2 karakter olmalıdır.",
    };
  }

  if (cleaned.length > 100) {
    return {
      valid: false,
      sanitized: cleaned,
      error: "Arama sorgusu en fazla 100 karakter olmalıdır.",
    };
  }

  return {
    valid: true,
    sanitized: cleaned,
  };
}

/**
 * In-Memory Sliding-Window Rate Limiter
 * 60 requests per 60 seconds per IP address.
 */
interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per window

/**
 * Checks whether an IP has exceeded rate limit.
 * Returns true if allowed, false if limit exceeded.
 */
export function checkSearchRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let record = rateLimitMap.get(ip);
  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(ip, record);
  }

  // Remove timestamps older than window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.timestamps.push(now);
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - record.timestamps.length,
  };
}

/**
 * Reset rate limit cache (used for unit tests)
 */
export function resetSearchRateLimiter(): void {
  rateLimitMap.clear();
}
