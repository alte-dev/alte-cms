/**
 * Email sanitization and security utilities.
 * Handles HTML escaping, header injection protection, and email masking.
 */

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
 * Validates hostname/domain format.
 */
export function isValidHostname(host: string): boolean {
  if (!host || typeof host !== "string") return false;
  const trimmed = host.trim();
  if (trimmed === "localhost" || trimmed === "127.0.0.1") return true;
  // Standard hostname regex
  return /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(trimmed);
}
