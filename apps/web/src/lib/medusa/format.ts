/**
 * Formats a numeric amount into Turkish Lira currency string (TRY).
 * Medusa v2 amounts are decimal major units (e.g. 89.90 TL).
 */
export function formatTRY(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export interface FreeShippingProgress {
  hasThreshold: boolean;
  isEligible: boolean;
  threshold: number | null;
  remaining: number | null;
  percent: number;
  message: string;
}

/**
 * Calculates dynamic progress towards free shipping based on cart item total and rule threshold.
 * Threshold is NOT hardcoded; it is passed dynamically from Medusa shipping options.
 */
export function calculateFreeShippingProgress(
  itemTotal: number,
  threshold?: number | null,
): FreeShippingProgress {
  if (threshold === undefined || threshold === null || threshold <= 0) {
    return {
      hasThreshold: false,
      isEligible: false,
      threshold: null,
      remaining: null,
      percent: 0,
      message: "",
    };
  }

  const current = Math.max(0, itemTotal);

  if (current >= threshold) {
    return {
      hasThreshold: true,
      isEligible: true,
      threshold,
      remaining: 0,
      percent: 100,
      message: "Tebrikler, kargonuz ücretsiz!",
    };
  }

  const remaining = threshold - current;
  const percent = Math.min(100, Math.round((current / threshold) * 100));

  return {
    hasThreshold: true,
    isEligible: false,
    threshold,
    remaining,
    percent,
    message: `Ücretsiz kargo için ${formatTRY(remaining)} daha ekleyin`,
  };
}

/**
 * Maps Medusa API errors into user-friendly Turkish messages.
 */
export function mapMedusaError(error: any): string {
  if (!error) return "Beklenmeyen bir hata oluştu.";

  const message = typeof error === "string" ? error : error.message || "";
  const code = error.code || "";
  const type = error.type || "";
  const lowerMsg = message.toLowerCase();

  if (
    code === "insufficient_inventory" ||
    type === "insufficient_inventory" ||
    lowerMsg.includes("insufficient_inventory") ||
    lowerMsg.includes("required inventory") ||
    lowerMsg.includes("inventory quantity")
  ) {
    return "Seçilen ürün için yetersiz stok. Lütfen adedi azaltın veya farklı bir varyant seçin.";
  }

  if (
    lowerMsg.includes("variant") &&
    (lowerMsg.includes("do not exist") ||
      lowerMsg.includes("not exist") ||
      lowerMsg.includes("not published"))
  ) {
    return "Seçilen ürün varyantı bulunamadı veya satışa kapalı.";
  }

  if (
    error.status === 404 ||
    code === "not_found" ||
    lowerMsg.includes("not found") ||
    lowerMsg.includes("bulunamadı")
  ) {
    return "Aradığınız ürün veya kayıt bulunamadı.";
  }

  if (
    lowerMsg.includes("do not exist") ||
    lowerMsg.includes("not exist") ||
    lowerMsg.includes("not published")
  ) {
    return "Seçilen ürün varyantı bulunamadı veya satışa kapalı.";
  }

  if (
    code === "SERVICE_UNAVAILABLE" ||
    error.status === 503 ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("fetch failed") ||
    lowerMsg.includes("bağlanılamadı")
  ) {
    return "Mağaza servisine şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.";
  }

  if (lowerMsg.includes("item_total") || lowerMsg.includes("shipping")) {
    return "Kargo seçeneği veya sepet tutarı kuralına ulaşılamadı.";
  }

  if (
    /^[a-zA-Z0-9_\s.,:'"-]+$/.test(message) &&
    (lowerMsg.includes("invalid") || lowerMsg.includes("error") || lowerMsg.includes("failed"))
  ) {
    return "İşlem gerçekleştirilemedi. Lütfen bilgilerinizi kontrol edip tekrar deneyin.";
  }

  return message || "İşlem gerçekleştirilemedi.";
}
