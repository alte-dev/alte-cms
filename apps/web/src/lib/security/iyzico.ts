const ALLOWED_IYZICO_REDIRECT_HOSTS = new Set([
  "sandbox-cpp.iyzipay.com",
  "cpp.iyzipay.com",
  "sandbox-api.iyzipay.com",
  "api.iyzipay.com",
]);

export function isAllowedIyzicoRedirectUrl(
  rawUrl: string,
  nodeEnv: string = process.env.NODE_ENV || "development",
): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (nodeEnv !== "production" && process.env.IYZICO_API_BASE) {
    try {
      const devBase = new URL(process.env.IYZICO_API_BASE);
      if (parsed.origin === devBase.origin) return true;
    } catch {
      // ignore
    }
  }

  if (parsed.protocol !== "https:") return false;
  return ALLOWED_IYZICO_REDIRECT_HOSTS.has(parsed.hostname);
}
