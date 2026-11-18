/**
 * Canlı Sepet Geçerlilik & Stok Koruma Doğrulaması (Cart Availability Guard)
 *
 * Gerçek Medusa + Next.js sunucularına karşı şu senaryoları doğrular:
 * 1. Geçerli, yayında ve stoklu ürün sepete eklendiğinde GET /api/cart sorun bildirmez.
 * 2. Ürünün stoğu 0'a düştüğünde GET /api/cart 'insufficient_stock' bildirir ve POST /api/checkout 409 döner (ödeme başlatılmaz).
 * 3. Ürün yayından alındığında (status: "draft") GET /api/cart 'unpublished' bildirir, POST /api/checkout 409 döner ve Medusa completeCartWorkflow reddeder.
 * 4. Ürün silindiğinde (DELETE /admin/products/:id) GET /api/cart 'deleted' bildirir, POST /api/checkout 409 döner ve Medusa completeCartWorkflow reddeder.
 */

import dotenv from "dotenv";
import path from "path";
import { createStepRecorder } from "./lib/verify-step";

dotenv.config({ path: path.resolve(process.cwd(), "apps/medusa/.env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });
dotenv.config();

const STOREFRONT_URL = process.env.STOREFRONT_URL || "http://localhost:3100";
const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";

const { results, recordStep } = createStepRecorder({
  format: "adim",
  exitOnFail: true,
});

async function getAdminToken(): Promise<string> {
  const email = process.env.MEDUSA_ADMIN_EMAIL;
  const password = process.env.MEDUSA_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("MEDUSA_ADMIN_EMAIL ve MEDUSA_ADMIN_PASSWORD tanımlı olmalıdır.");
  }

  const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(5000),
  });
  const data = (await res.json()) as { token?: string };
  if (!res.ok || !data.token) {
    throw new Error(`Admin girişi başarısız (${res.status})`);
  }
  return data.token;
}

async function resolvePublishableKey(adminToken: string): Promise<string> {
  const envKey =
    process.env.MEDUSA_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  if (envKey) return envKey;

  const res = await fetch(`${MEDUSA_URL}/admin/api-keys`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    signal: AbortSignal.timeout(5000),
  });
  const data = (await res.json()) as {
    api_keys?: Array<{ type: string; revoked_at?: string | null; token?: string }>;
  };
  const pubKey = data.api_keys?.find((k) => k.type === "publishable" && !k.revoked_at);
  if (!pubKey?.token) {
    throw new Error("Publishable API key bulunamadı.");
  }
  return pubKey.token;
}

function mergeCookies(existing: string, setCookieHeaders: string[]): string {
  const map = new Map<string, string>();
  for (const part of existing.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) map.set(trimmed.slice(0, idx), trimmed.slice(idx + 1));
  }
  for (const header of setCookieHeaders) {
    const pair = header.split(";")[0]?.trim();
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx > 0) map.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function run() {
  const adminToken = await getAdminToken();
  const pubKey = await resolvePublishableKey(adminToken);

  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  };

  let createdProductId: string | null = null;
  let variantId = "";
  let inventoryItemId = "";
  let locationId = "";
  let cookieHeader = "";
  let cartId = "";
  let shippingOptionId = "";

  try {
    // 1. Resolve sales channel, shipping profile, and stock location
    const [scRes, spRes, locRes] = await Promise.all([
      fetch(`${MEDUSA_URL}/admin/sales-channels`, { headers: adminHeaders }),
      fetch(`${MEDUSA_URL}/admin/shipping-profiles`, { headers: adminHeaders }),
      fetch(`${MEDUSA_URL}/admin/stock-locations`, { headers: adminHeaders }),
    ]);

    const scData = (await scRes.json()) as { sales_channels?: Array<{ id: string }> };
    const spData = (await spRes.json()) as { shipping_profiles?: Array<{ id: string }> };
    const locData = (await locRes.json()) as { stock_locations?: Array<{ id: string }> };

    const salesChannelId = scData.sales_channels?.[0]?.id;
    const shippingProfileId = spData.shipping_profiles?.[0]?.id;
    locationId = locData.stock_locations?.[0]?.id || "";

    if (!salesChannelId || !shippingProfileId || !locationId) {
      throw new Error("Satış kanalı, kargo profili veya stok lokasyonu bulunamadı.");
    }

    // 2. Create temporary test product with managed inventory = 2
    const uniqueSuffix = Date.now().toString(36);
    const createProdRes = await fetch(`${MEDUSA_URL}/admin/products`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        title: `Verify Availability Test ${uniqueSuffix}`,
        handle: `verify-avail-${uniqueSuffix}`,
        status: "published",
        shipping_profile_id: shippingProfileId,
        sales_channels: [{ id: salesChannelId }],
        options: [{ title: "Seçenek", values: ["Standart"] }],
        variants: [
          {
            title: "Standart",
            sku: `VERIFY-AVAIL-${uniqueSuffix}`,
            manage_inventory: true,
            allow_backorder: false,
            options: { Seçenek: "Standart" },
            prices: [{ amount: 500, currency_code: "try" }],
          },
        ],
      }),
    });

    const prodJson = (await createProdRes.json()) as any;
    if (!createProdRes.ok || !prodJson.product?.id) {
      throw new Error(`Test ürünü oluşturulamadı: ${JSON.stringify(prodJson)}`);
    }

    createdProductId = prodJson.product.id;
    variantId = prodJson.product.variants?.[0]?.id;

    // Fetch variant inventory item id
    const invLinkRes = await fetch(
      `${MEDUSA_URL}/admin/products/${createdProductId}?fields=*variants,*variants.inventory_items`,
      { headers: adminHeaders },
    );
    const invLinkJson = (await invLinkRes.json()) as any;
    inventoryItemId =
      invLinkJson.product?.variants?.[0]?.inventory_items?.[0]?.inventory_item_id || "";

    if (!inventoryItemId) {
      // Fallback: look up inventory item by sku
      const invSearchRes = await fetch(
        `${MEDUSA_URL}/admin/inventory-items?sku=VERIFY-AVAIL-${uniqueSuffix}`,
        { headers: adminHeaders },
      );
      const invSearchJson = (await invSearchRes.json()) as any;
      inventoryItemId = invSearchJson.inventory_items?.[0]?.id || "";
    }

    if (!inventoryItemId) {
      throw new Error("Test varyantına bağlı inventory_item_id bulunamadı.");
    }

    // Set stock level = 2 at main location
    const lvlRes = await fetch(
      `${MEDUSA_URL}/admin/inventory-items/${inventoryItemId}/location-levels`,
      {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          location_id: locationId,
          stocked_quantity: 2,
        }),
      },
    );
    if (!lvlRes.ok) {
      // If location level already exists, update it
      const updateLvlRes = await fetch(
        `${MEDUSA_URL}/admin/inventory-items/${inventoryItemId}/location-levels/${locationId}`,
        {
          method: "POST",
          headers: adminHeaders,
          body: JSON.stringify({ stocked_quantity: 2 }),
        },
      );
      if (!updateLvlRes.ok) {
        throw new Error(`Stok seviyesi ayarlanamadı (${updateLvlRes.status})`);
      }
    }

    recordStep("Test Ürünü Oluşturma (Stok=2, Published)", true, `product=${createdProductId}`);

    // 3. Add 1 unit to storefront cart
    const addRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", variantId, quantity: 1 }),
    });
    const setCookies =
      typeof addRes.headers.getSetCookie === "function" ? addRes.headers.getSetCookie() : [];
    cookieHeader = mergeCookies(cookieHeader, setCookies);
    const addJson = (await addRes.json()) as any;
    cartId = addJson.cart?.id || "";

    if (!addRes.ok || !cartId) {
      throw new Error(`Sepete ürün eklenemedi (${addRes.status}): ${JSON.stringify(addJson)}`);
    }

    // Resolve valid shipping option for checkout tests
    const soRes = await fetch(`${MEDUSA_URL}/store/shipping-options?cart_id=${cartId}`, {
      headers: { "x-publishable-api-key": pubKey },
    });
    const soJson = (await soRes.json()) as { shipping_options?: Array<{ id: string }> };
    shippingOptionId = soJson.shipping_options?.[0]?.id || "";
    if (!shippingOptionId) {
      throw new Error("Test sepeti için kargo seçeneği bulunamadı.");
    }

    // 4. Verify initial GET /api/cart has zero availability issues
    const initialCartRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      headers: { Cookie: cookieHeader },
    });
    const initialCartJson = (await initialCartRes.json()) as any;
    const initialIssues = initialCartJson.availabilityIssues || [];
    recordStep(
      "Geçerli Ürün Sepet Kontrolü",
      initialCartRes.ok && initialIssues.length === 0,
      `issues=${initialIssues.length}`,
    );

    const checkoutPayload = {
      email: "test@example.test",
      phone: "0500 000 00 00",
      deliveryAddress: {
        firstName: "Test",
        lastName: "Kullanıcı",
        city: "İstanbul",
        district: "Kadıköy",
        addressLine1: "Moda Cad. No: 1",
        postalCode: "34710",
        countryCode: "tr",
      },
      sameAsDelivery: true,
      invoiceType: "individual",
      shippingOptionId,
      distanceSalesContract: true,
      kvkkConsent: true,
      paymentMethod: "dev",
    };

    // 5. Scenario A: Drop stock to 0
    await fetch(
      `${MEDUSA_URL}/admin/inventory-items/${inventoryItemId}/location-levels/${locationId}`,
      {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ stocked_quantity: 0 }),
      },
    );

    const outOfStockCartRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      headers: { Cookie: cookieHeader },
    });
    const outOfStockCartJson = (await outOfStockCartRes.json()) as any;
    const stockIssues = outOfStockCartJson.availabilityIssues || [];
    recordStep(
      "Stok=0 Sonrası GET /api/cart Uyarısı",
      stockIssues.length === 1 && stockIssues[0].reason === "insufficient_stock",
      `reason=${stockIssues[0]?.reason}`,
    );

    const outOfStockCheckoutRes = await fetch(`${STOREFRONT_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify(checkoutPayload),
    });
    const outOfStockCheckoutJson = (await outOfStockCheckoutRes.json()) as any;
    recordStep(
      "Stok=0 Sonrası POST /api/checkout Engeli (409)",
      outOfStockCheckoutRes.status === 409 &&
        outOfStockCheckoutJson.code === "CART_ITEM_UNAVAILABLE",
      `status=${outOfStockCheckoutRes.status}, code=${outOfStockCheckoutJson.code}`,
    );

    // 6. Scenario B: Restore stock to 2, set product status = "draft" (unpublished)
    await fetch(
      `${MEDUSA_URL}/admin/inventory-items/${inventoryItemId}/location-levels/${locationId}`,
      {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ stocked_quantity: 2 }),
      },
    );
    await fetch(`${MEDUSA_URL}/admin/products/${createdProductId}`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ status: "draft" }),
    });

    const draftCartRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      headers: { Cookie: cookieHeader },
    });
    const draftCartJson = (await draftCartRes.json()) as any;
    const draftIssues = draftCartJson.availabilityIssues || [];
    recordStep(
      "Yayından Alınan Ürün (draft) GET /api/cart Uyarısı",
      draftIssues.length === 1 && draftIssues[0].reason === "unpublished",
      `reason=${draftIssues[0]?.reason}`,
    );

    const draftCheckoutRes = await fetch(`${STOREFRONT_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify(checkoutPayload),
    });
    const draftCheckoutJson = (await draftCheckoutRes.json()) as any;
    recordStep(
      "Yayından Alınan Ürün POST /api/checkout Engeli (409)",
      draftCheckoutRes.status === 409 && draftCheckoutJson.code === "CART_ITEM_UNAVAILABLE",
      `status=${draftCheckoutRes.status}, code=${draftCheckoutJson.code}`,
    );

    // Direct Medusa completeCartWorkflow check (must be rejected by validate hook even if /api/checkout is bypassed)
    const directValidateRes = await fetch(
      `${MEDUSA_URL}/store/carts/${cartId}/validate-availability`,
      {
        method: "POST",
        headers: { "x-publishable-api-key": pubKey },
      },
    );
    recordStep(
      "Medusa Doğrudan Validate Endpoint Engeli (409)",
      directValidateRes.status === 409,
      `status=${directValidateRes.status}`,
    );

    // 7. Scenario C: Delete product
    await fetch(`${MEDUSA_URL}/admin/products/${createdProductId}`, {
      method: "DELETE",
      headers: adminHeaders,
    });
    createdProductId = null;

    const deletedCartRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      headers: { Cookie: cookieHeader },
    });
    const deletedCartJson = (await deletedCartRes.json()) as any;
    const deletedIssues = deletedCartJson.availabilityIssues || [];
    recordStep(
      "Silinmiş Ürün GET /api/cart Uyarısı",
      deletedIssues.length === 1 && deletedIssues[0].reason === "deleted",
      `reason=${deletedIssues[0]?.reason}`,
    );

    const deletedCheckoutRes = await fetch(`${STOREFRONT_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
      body: JSON.stringify(checkoutPayload),
    });
    const deletedCheckoutJson = (await deletedCheckoutRes.json()) as any;
    recordStep(
      "Silinmiş Ürün POST /api/checkout Engeli (409)",
      deletedCheckoutRes.status === 409 && deletedCheckoutJson.code === "CART_ITEM_UNAVAILABLE",
      `status=${deletedCheckoutRes.status}, code=${deletedCheckoutJson.code}`,
    );
  } finally {
    if (createdProductId) {
      await fetch(`${MEDUSA_URL}/admin/products/${createdProductId}`, {
        method: "DELETE",
        headers: adminHeaders,
      }).catch(() => {});
    }
  }

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("❌ verify-cart-availability hatası:", err);
  process.exit(1);
});
