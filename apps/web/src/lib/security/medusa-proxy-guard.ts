const FORBIDDEN_RAW_PATTERNS = [
  /\.\./,
  /\/\.(?:\/|$)/,
  /%2e/i,
  /%2f/i,
  /%5c/i,
  /%00/i,
  /%25/i,
  /\\/,
  /\/\//,
  /;/,
];

const ALLOWLIST_PATTERNS = [
  /^\/admin(?:\/.*)?$/,
  /^\/auth\/user(?:\/.*)?$/,
  /^\/auth\/session$/,
  /^\/auth\/token\/refresh$/,
];

/**
 * Validates raw `/medusa-api/*` request pathname against path traversal,
 * encoded dot/slash/backslash/null/semicolon tricks, and strict allowlist.
 */
export function isAllowedMedusaProxyPath(rawPathname: string): boolean {
  if (!rawPathname || typeof rawPathname !== "string") {
    return false;
  }

  for (const pattern of FORBIDDEN_RAW_PATTERNS) {
    if (pattern.test(rawPathname)) {
      return false;
    }
  }

  if (!rawPathname.startsWith("/medusa-api/")) {
    return false;
  }

  const subPath = rawPathname.slice("/medusa-api".length);
  return ALLOWLIST_PATTERNS.some((re) => re.test(subPath));
}
