const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_REGEX = /^[+0-9()\-\s]{7,25}$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hasControlOrNul(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) {
      return true;
    }
  }
  return false;
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254 || hasControlOrNul(email)) return false;
  return EMAIL_REGEX.test(email);
}

export function escapeCsvFormula(value: string): string {
  if (!value) return value;
  const first = value[0];
  if (
    first === "=" ||
    first === "+" ||
    first === "-" ||
    first === "@" ||
    first === "\t" ||
    first === "\r"
  ) {
    return `'${value}`;
  }
  return value;
}

export function sanitizeTextField(
  raw: string | undefined,
  maxLength: number,
): { value: string; truncated: boolean; invalid: boolean } {
  const str = (raw ?? "").trim();
  if (!str) return { value: "", truncated: false, invalid: false };
  if (hasControlOrNul(str)) {
    return { value: "", truncated: false, invalid: true };
  }
  if (str.length > maxLength) {
    return { value: str.slice(0, maxLength), truncated: true, invalid: false };
  }
  return { value: str, truncated: false, invalid: false };
}

export function sanitizePhone(raw: string | undefined): {
  value: string | null;
  malformed: boolean;
} {
  const str = (raw ?? "").trim();
  if (!str) return { value: null, malformed: false };
  if (hasControlOrNul(str) || !PHONE_REGEX.test(str)) {
    return { value: null, malformed: true };
  }
  return { value: str, malformed: false };
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const atIdx = normalized.indexOf("@");
  if (atIdx <= 0 || atIdx === normalized.length - 1) return "***";
  const local = normalized.slice(0, atIdx);
  const domain = normalized.slice(atIdx + 1);
  const dotIdx = domain.lastIndexOf(".");
  const localMasked = `${local[0]}***`;
  if (dotIdx <= 0) {
    return `${localMasked}@${domain[0]}***`;
  }
  const domPrefix = domain.slice(0, dotIdx);
  const tld = domain.slice(dotIdx);
  return `${localMasked}@${domPrefix[0]}***${tld}`;
}
