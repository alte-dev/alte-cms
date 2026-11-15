/**
 * Email sanitization and security utilities.
 * Handles HTML escaping, header injection protection, and email masking.
 */
import net from "net";

/**
 * Escapes HTML characters in text to prevent HTML/XSS injection in email templates.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  const str = String(input);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Strips carriage returns and newlines to prevent email header injection (CRLF injection).
 */
export function sanitizeHeader(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/[\r\n]+/g, " ")
    .trim();
}

/**
 * Validates email address format with a safe regex.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  // RFC 5322 compliant safe regex avoiding ReDoS
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim());
}

/**
 * Masks an email address for logging and UI display to comply with KVKK / GDPR.
 * e.g., "customer@example.test" -> "c***@example.test"
 * e.g., "a@b.com" -> "*@b.com"
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "***";
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return "***";

  const userPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex);

  if (userPart.length <= 1) {
    return `*${domainPart}`;
  }
  return `${userPart[0]}***${domainPart}`;
}

/**
 * Validates SMTP port range.
 */
export function isValidSmtpPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Validates hostname/domain or IP address format.
 */
export function isValidHostname(host: string): boolean {
  if (!host || typeof host !== "string") return false;
  const trimmed = host.trim();
  if (!trimmed || trimmed.length > 253) return false;
  if (trimmed === "localhost") return true;
  const unwrapped = trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
  if (net.isIP(unwrapped) !== 0) return true;
  // Standard hostname regex
  return /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(trimmed);
}

/**
 * Checks whether a host belongs to link-local / cloud metadata / CGNAT-metadata ranges
 * that must be blocked in production:
 * - 169.254.0.0/16 (IPv4 link-local / cloud instance metadata)
 * - fe80::/10 (IPv6 link-local)
 * - 100.64.0.0/10 (Carrier-grade NAT / Alibaba Cloud metadata 100.100.100.200)
 * Note: 127.0.0.1 and RFC1918 private addresses are intentionally allowed for local/LAN mail relays.
 */
export function isBlockedSmtpMetadataHost(host: string): boolean {
  if (!host || typeof host !== "string") return false;
  let normalized = host.trim().toLowerCase();
  if (normalized.startsWith("[") && normalized.endsWith("]")) {
    normalized = normalized.slice(1, -1);
  }
  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.slice("::ffff:".length);
  }

  if (net.isIPv4(normalized)) {
    const parts = normalized.split(".").map((n) => Number.parseInt(n, 10));
    const [a, b] = parts;
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10
    return false;
  }

  if (net.isIPv6(normalized)) {
    // fe80::/10 covers fe80..febf in the first hextet
    if (/^fe[89ab][0-9a-f]?:/i.test(normalized)) return true;
  }

  return false;
}

export function validateSmtpHost(
  host: string,
  nodeEnv: string = process.env.NODE_ENV || "development",
): { valid: boolean; error?: string } {
  if (!isValidHostname(host)) {
    return { valid: false, error: "Geçersiz SMTP sunucu adresi (hostname/IP)." };
  }
  if (nodeEnv === "production" && isBlockedSmtpMetadataHost(host)) {
    return {
      valid: false,
      error: "Link-local veya bulut metadata adresleri üretim ortamında SMTP sunucusu olarak kullanılamaz.",
    };
  }
  return { valid: true };
}
