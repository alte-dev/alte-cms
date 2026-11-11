import fs from "fs";
import path from "path";
import { chromium, type Browser, type LaunchOptions } from "playwright";
import { expect } from "vitest";

export interface VariantCandidate {
  id: string;
  sku?: string | null;
  unitPrice: number;
  availableQuantity: number;
}

export interface PlannedCartItem {
  variantId: string;
  unitPrice: number;
  quantity: number;
}

/**
 * Builds Playwright Chromium launch options using `CHROME_PATH` when provided
 * or Playwright's bundled Chromium executable otherwise.
 */
export function resolveChromiumLaunchOptions(
  env: Record<string, string | undefined> = process.env,
  extraArgs: string[] = [],
): LaunchOptions {
  const chromePath = env.CHROME_PATH?.trim() ? env.CHROME_PATH.trim() : undefined;
  return {
    headless: true,
    ...(chromePath ? { executablePath: chromePath } : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", ...extraArgs],
  };
}

/**
 * Shared helper for launching headless Chromium across all tests and scripts.
 */
export async function launchHeadlessChromium(extraArgs: string[] = []): Promise<Browser> {
  return chromium.launch(resolveChromiumLaunchOptions(process.env, extraArgs));
}

/**
 * Fails loudly when `REQUIRE_LIVE_SERVER=true` and calls `ctx.skip()` when offline in unit test runs.
 */
export function handleLiveServerAbsence(
  ctx: { skip: () => void },
  reason: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (env.REQUIRE_LIVE_SERVER === "true") {
    expect.fail(`${reason} (REQUIRE_LIVE_SERVER=true iken test atlanamaz.)`);
  }
  ctx.skip();
}

/**
 * Dynamically calculates cart line items to strictly meet/exceed the free shipping threshold
 * without relying on a hardcoded product price or fixed quantity=4.
 */
export function planCartItemsToExceedThreshold(
  variants: VariantCandidate[],
  threshold: number | null | undefined,
): PlannedCartItem[] {
  const targetAmount = threshold && threshold > 0 ? threshold : 1500;
  const eligible = variants
    .filter(
      (v) => v.id && v.sku !== "SERVICE-COD-FEE" && v.unitPrice > 0 && v.availableQuantity > 0,
    )
    .sort((a, b) => b.unitPrice - a.unitPrice);

  const plan: PlannedCartItem[] = [];
  let accumulated = 0;

  for (const variant of eligible) {
    if (accumulated >= targetAmount) break;
    const remaining = targetAmount - accumulated;
    const neededQty = Math.ceil(remaining / variant.unitPrice);
    const qtyToAdd = Math.min(neededQty, variant.availableQuantity, 99);
    if (qtyToAdd > 0) {
      plan.push({
        variantId: variant.id,
        unitPrice: variant.unitPrice,
        quantity: qtyToAdd,
      });
      accumulated += qtyToAdd * variant.unitPrice;
    }
  }

  return plan;
}

/**
 * Resolves the Medusa publishable API key from environment, local .env files, or Medusa Admin API.
 */
export async function resolveMedusaPublishableKey(medusaUrl: string): Promise<string> {
  const fromEnv =
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || process.env.MEDUSA_PUBLISHABLE_KEY;
  if (fromEnv && fromEnv.startsWith("pk_")) {
    return fromEnv.trim();
  }

  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "apps/web/.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf8");
        const match =
          content.match(/^NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=(pk_[^\s\r\n]+)/m) ||
          content.match(/^MEDUSA_PUBLISHABLE_KEY=(pk_[^\s\r\n]+)/m);
        if (match?.[1]) {
          return match[1].trim();
        }
      }
    } catch {
      // ignore file read errors
    }
  }

  const adminEmail = process.env.MEDUSA_ADMIN_EMAIL || "admin@example.test";
  const adminPassword = process.env.MEDUSA_ADMIN_PASSWORD || "supersecret-test-password";
  try {
    const authRes = await fetch(`${medusaUrl}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      signal: AbortSignal.timeout(5000),
    });
    if (authRes.ok) {
      const authData = (await authRes.json()) as { token?: string };
      if (authData.token) {
        const keysRes = await fetch(`${medusaUrl}/admin/api-keys`, {
          headers: { Authorization: `Bearer ${authData.token}` },
          signal: AbortSignal.timeout(5000),
        });
        if (keysRes.ok) {
          const keysData = (await keysRes.json()) as {
            api_keys?: Array<{ token?: string; type?: string; revoked_at?: string | null }>;
          };
          const pub = keysData.api_keys?.find((k) => k.type === "publishable" && !k.revoked_at);
          if (pub?.token) return pub.token;
        }
      }
    }
  } catch {
    // ignore admin fallback errors
  }

  return "";
}

/**
 * Creates a live Medusa cart whose product subtotal dynamically exceeds the configured free shipping threshold.
 */
export async function createLiveCartExceedingFreeShipping(
  medusaUrl: string,
  pubKey: string,
): Promise<{ cartId: string; totalAddedAmount: number; threshold: number }> {
  const headers = {
    "Content-Type": "application/json",
    "x-publishable-api-key": pubKey,
  };

  const [rulesRes, regRes] = await Promise.all([
    fetch(`${medusaUrl}/store/shipping-rules`, { headers, signal: AbortSignal.timeout(5000) }),
    fetch(`${medusaUrl}/store/regions`, { headers, signal: AbortSignal.timeout(5000) }),
  ]);

  if (!regRes.ok) {
    throw new Error(`Medusa /store/regions HTTP ${regRes.status} döndü.`);
  }

  const rulesData = rulesRes.ok ? ((await rulesRes.json()) as { threshold?: number | null }) : {};
  const threshold =
    typeof rulesData.threshold === "number" && rulesData.threshold > 0 ? rulesData.threshold : 1500;

  const regData = (await regRes.json()) as { regions?: Array<{ id: string }> };
  const regionId = regData.regions?.[0]?.id;
  if (!regionId) {
    throw new Error("Medusa'da aktif bölge (region) bulunamadı.");
  }

  const prodRes = await fetch(
    `${medusaUrl}/store/products?region_id=${encodeURIComponent(regionId)}&limit=50&fields=*variants,*variants.calculated_price,*variants.inventory_quantity`,
    { headers, signal: AbortSignal.timeout(5000) },
  );
  if (!prodRes.ok) {
    throw new Error(`Medusa /store/products HTTP ${prodRes.status} döndü.`);
  }

  const prodData = (await prodRes.json()) as {
    products?: Array<{
      handle?: string;
      variants?: Array<{
        id: string;
        sku?: string | null;
        manage_inventory?: boolean;
        allow_backorder?: boolean;
        inventory_quantity?: number;
        calculated_price?: { calculated_amount?: number };
        prices?: Array<{ amount?: number }>;
      }>;
    }>;
  };

  const candidates: VariantCandidate[] = [];
  for (const prod of prodData.products || []) {
    if (prod.handle === "kapida-odeme-hizmet-bedeli") continue;
    for (const v of prod.variants || []) {
      if (v.sku === "SERVICE-COD-FEE") continue;
      const unitPrice = Number(v.calculated_price?.calculated_amount ?? v.prices?.[0]?.amount ?? 0);
      const availableQuantity =
        v.manage_inventory === false || v.allow_backorder === true
          ? 99
          : typeof v.inventory_quantity === "number"
            ? v.inventory_quantity
            : 50;
      if (unitPrice > 0 && availableQuantity > 0) {
        candidates.push({
          id: v.id,
          sku: v.sku,
          unitPrice,
          availableQuantity,
        });
      }
    }
  }

  const plan = planCartItemsToExceedThreshold(candidates, threshold);
  const plannedTotal = plan.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (plan.length === 0 || plannedTotal < threshold) {
    throw new Error(
      `Ücretsiz kargo eşiğini (${threshold} TL) aşacak yeterli stoklu ürün bulunamadı (planlanan: ${plannedTotal} TL).`,
    );
  }

  const cartRes = await fetch(`${medusaUrl}/store/carts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ region_id: regionId }),
    signal: AbortSignal.timeout(5000),
  });
  if (!cartRes.ok) {
    throw new Error(`Medusa sepet oluşturulamadı: HTTP ${cartRes.status}`);
  }
  const cartData = (await cartRes.json()) as { cart?: { id: string } };
  const cartId = cartData.cart?.id;
  if (!cartId) {
    throw new Error("Medusa sepet yanıtında cart.id bulunamadı.");
  }

  for (const item of plan) {
    const addRes = await fetch(`${medusaUrl}/store/carts/${cartId}/line-items`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        variant_id: item.variantId,
        quantity: item.quantity,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!addRes.ok) {
      const errTxt = await addRes.text().catch(() => "");
      throw new Error(
        `Sepete ürün (${item.variantId} x ${item.quantity}) eklenemedi: HTTP ${addRes.status} ${errTxt}`,
      );
    }
  }

  return { cartId, totalAddedAmount: plannedTotal, threshold };
}
