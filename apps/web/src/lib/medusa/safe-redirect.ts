const SANITIZE_BASE_ORIGIN = "http://sanitize.invalid";
const MAX_REDIRECT_LENGTH = 2048;

/**
 * İzin verilen storefront yönlendirme yolları (izin listesi):
 * - `/` (ana sayfa)
 * - `/odeme` ve alt yolları (ör. `/odeme/sonuc`)
 * - `/sepet` ve alt yolları
 * - `/hesap` ve alt yolları (ör. `/hesap/siparisler`)
 * - `/urunler` ve alt yolları
 * - `/urun/<slug>` ürün detay sayfaları
 */
function isAllowedRedirectPathname(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/odeme" || pathname.startsWith("/odeme/")) return true;
  if (pathname === "/sepet" || pathname.startsWith("/sepet/")) return true;
  if (pathname === "/hesap" || pathname.startsWith("/hesap/")) return true;
  if (pathname === "/urunler" || pathname.startsWith("/urunler/")) return true;
  if (pathname.startsWith("/urun/") && pathname.length > "/urun/".length) return true;
  return false;
}

/**
 * Yönlendirme yolunu yalnızca izin verilen yerel storefront rotalarıyla sınırlar.
 * Açık yönlendirme (open redirect) ve kontrol karakteri / sekme (TAB) bypass'larını engeller.
 */
export function sanitizeRedirectPath(raw: string | undefined | null, fallback = "/hesap"): string {
  if (!raw || typeof raw !== "string") return fallback;

  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_REDIRECT_LENGTH) return fallback;
  if (!trimmed.startsWith("/")) return fallback;

  // Kontrol karakterleri (\x00-\x20, \x7f) ve tüm Unicode boşluk karakterlerini reddet
  if (/[\u0000-\u0020\u007f\s]/.test(trimmed)) return fallback;

  // Çift eğik çizgi ve ters eğik çizgi dizilerini reddet
  if (trimmed.includes("//") || trimmed.includes("\\")) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(trimmed, SANITIZE_BASE_ORIGIN);
  } catch {
    return fallback;
  }

  if (parsed.origin !== SANITIZE_BASE_ORIGIN) return fallback;
  if (parsed.username || parsed.password) return fallback;
  if (!parsed.pathname.startsWith("/") || parsed.pathname.includes("//")) return fallback;
  if (!isAllowedRedirectPathname(parsed.pathname)) return fallback;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
