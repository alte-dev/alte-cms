const ALLOWED_IYZICO_REDIRECT_HOSTS: Record<"sandbox" | "live", Set<string>> = {
  sandbox: new Set(["sandbox-cpp.iyzipay.com", "sandbox-api.iyzipay.com"]),
  live: new Set(["cpp.iyzipay.com", "api.iyzipay.com"]),
};

export function isAllowedIyzicoRedirectUrl(
  rawUrl: string,
  mode: "sandbox" | "live" = "sandbox",
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
  return ALLOWED_IYZICO_REDIRECT_HOSTS[mode].has(parsed.hostname);
}
