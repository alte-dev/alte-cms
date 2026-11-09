/**
 * Safe Href utility for user-supplied link targets.
 * Enforces that all links are either safe internal paths (starting with '/')
 * or secure external URLs (strictly starting with 'https://').
 * Rejects dangerous protocols (javascript:, data:, vbscript:) and protocol-relative tricks (//).
 */

const DANGEROUS_PROTOCOLS = /^(javascript|data|vbscript|file):/i;

/**
 * Checks whether a URL/path is safe to use in an href or redirection.
 */
export function isSafeHref(href: unknown): boolean {
  if (typeof href !== "string") return false;

  // Strip control chars, zero-width chars, and leading/trailing whitespace
  const sanitized = href.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, "");
  if (!sanitized) return false;

  // Block dangerous schemes
  if (DANGEROUS_PROTOCOLS.test(sanitized)) {
    return false;
  }

  // Block protocol-relative URLs (//evil.com) and Windows UNC paths (\\evil.com)
  if (sanitized.startsWith("//") || sanitized.startsWith("\\\\")) {
    return false;
  }

  // Block backslash path traversal tricks (/\\evil.com or \/evil.com)
  if (sanitized.includes("\\")) {
    return false;
  }

  // Accept secure external HTTPS links
  if (/^https:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/i.test(sanitized)) {
    try {
      const parsed = new URL(sanitized);
      return parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  // Accept safe internal paths starting with single '/'
  // Ensure the second character is not another slash or backslash
  if (sanitized.startsWith("/") && !sanitized.startsWith("//")) {
    return true;
  }

  return false;
}

/**
 * Sanitizes an href to ensure safety. Returns fallback if invalid.
 */
export function safeHref(href: unknown, fallback = "/"): string {
  if (isSafeHref(href)) {
    return (href as string).trim();
  }
  return fallback;
}

/**
 * Payload field validation function for links.
 */
export function validateSafeHrefField(val: unknown): true | string {
  if (!val) return true; // Optional link
  if (typeof val !== "string") return "Geçersiz bağlantı formatı.";

  const trimmed = val.trim();
  if (trimmed === "") return true;

  if (!isSafeHref(trimmed)) {
    return "Bağlantı adresi yalnızca '/' ile başlayan bir iç yol (örn: /blog) veya 'https://' ile başlayan güvenli bir harici adres olmalıdır.";
  }

  return true;
}
