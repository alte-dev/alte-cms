export function sanitizeRedirectPath(raw: string | undefined | null, fallback = "/hesap"): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (/[\r\n\0]/.test(trimmed)) return fallback;
  return trimmed;
}
