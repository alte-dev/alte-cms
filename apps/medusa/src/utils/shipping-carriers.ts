import crypto from "crypto";

export interface ShippingCarrier {
  id: string;
  name: string;
  domain: string;
  urlTemplate: string;
}

export const SUPPORTED_CARRIERS: Record<string, ShippingCarrier> = {
  yurtici: {
    id: "yurtici",
    name: "Yurtiçi Kargo",
    domain: "yurticikargo.com",
    urlTemplate: "https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code={code}",
  },
  aras: {
    id: "aras",
    name: "Aras Kargo",
    domain: "araskargo.com.tr",
    urlTemplate: "https://www.araskargo.com.tr/kargo-takip?code={code}",
  },
  mng: {
    id: "mng",
    name: "MNG Kargo",
    domain: "mngkargo.com.tr",
    urlTemplate: "https://kargotakip.mngkargo.com.tr/?code={code}",
  },
  ptt: {
    id: "ptt",
    name: "PTT Kargo",
    domain: "ptt.gov.tr",
    urlTemplate: "https://gonderitakip.ptt.gov.tr/Track/Verify?q={code}",
  },
  surat: {
    id: "surat",
    name: "Sürat Kargo",
    domain: "suratkargo.com.tr",
    urlTemplate: "https://suratkargo.com.tr/KargoTakip/?kargotakipno={code}",
  },
  hepsijet: {
    id: "hepsijet",
    name: "HepsiJet",
    domain: "hepsijet.com",
    urlTemplate: "https://www.hepsijet.com/gonderi-takibi/{code}",
  },
  diger: {
    id: "diger",
    name: "Diğer Kargo",
    domain: "",
    urlTemplate: "",
  },
};

/**
 * Validates tracking code format:
 * - Must be 1 to 40 characters
 * - Only alphanumeric and hyphen allowed [A-Za-z0-9\-]
 */
export function validateTrackingCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const trimmed = code.trim();
  if (trimmed.length < 1 || trimmed.length > 40) return false;
  return /^[A-Za-z0-9\-]+$/.test(trimmed);
}

/**
 * Generates and validates tracking URL for a given carrier and code.
 * Strictly prevents open-redirect and XSS (only https:// with whitelisted domains).
 */
export function buildTrackingUrl(
  carrierId: string,
  trackingCode: string,
  customUrl?: string,
): string {
  if (!validateTrackingCode(trackingCode)) {
    throw new Error(
      "Geçersiz kargo takip kodu. Yalnızca harf, rakam ve tire (-) içerebilir (en fazla 40 karakter).",
    );
  }

  const encodedCode = encodeURIComponent(trackingCode.trim());
  const carrier = SUPPORTED_CARRIERS[carrierId.toLowerCase()];

  let targetUrl = "";

  if (carrier && carrier.urlTemplate) {
    targetUrl = carrier.urlTemplate.replace("{code}", encodedCode);
  } else if (customUrl && typeof customUrl === "string") {
    targetUrl = customUrl.trim();
  } else {
    return "";
  }

  // Security checks:
  // 1. Must start strictly with https://
  if (!targetUrl.startsWith("https://")) {
    throw new Error(
      "Kargo takip bağlantısı güvenlik nedeniyle yalnızca HTTPS protokolünü kullanabilir.",
    );
  }

  // 2. Reject javascript:, data:, vbscript: schemes
  const lower = targetUrl.toLowerCase();
  if (
    lower.includes("javascript:") ||
    lower.includes("data:") ||
    lower.includes("vbscript:") ||
    lower.startsWith("//")
  ) {
    throw new Error("Geçersiz veya güvensiz takip bağlantısı.");
  }

  // 3. Domain validation
  try {
    const parsed = new URL(targetUrl);
    if (carrier && carrier.domain) {
      if (!parsed.hostname.endsWith(carrier.domain)) {
        throw new Error(
          `Kargo takip adresi ${carrier.name} alan adı (${carrier.domain}) ile eşleşmiyor.`,
        );
      }
    }
    return parsed.toString();
  } catch (err: any) {
    throw new Error(`Kargo takip adresi geçersiz: ${err.message}`);
  }
}

/**
 * Timing-safe string comparison to protect against timing attacks.
 * Normalizes Turkish case folding (I/ı/İ/i).
 */
export function timingSafeEmailMatch(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;

  // Normalize Turkish & ASCII email variants: İ -> i, I -> i, ı -> i
  const normalizeEmail = (email: string) =>
    email
      .trim()
      .replace(/İ/g, "i")
      .replace(/I/g, "i")
      .replace(/ı/g, "i")
      .toLowerCase()
      .replace(/i\u0307/g, "i");

  const normA = normalizeEmail(a);
  const normB = normalizeEmail(b);

  const hashA = crypto.createHash("sha256").update(normA, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(normB, "utf8").digest();

  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Sanitizes a CSV cell to prevent CSV Formula / Command Injection.
 * Prepends a single quote (') if the value starts with dangerous spreadsheet characters: =, +, -, @, \t, \r
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // Dangerous spreadsheet formula triggers
  if (/^[=\+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape inner double quotes by doubling them
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}
