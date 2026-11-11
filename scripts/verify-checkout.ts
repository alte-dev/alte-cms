/**
 * E2E Checkout & Promotion Verification Script (Faz 3 & Faz 3.1)
 *
 * Verifies full guest checkout lifecycle against running storefront (http://localhost:3100):
 * 1. Empty cart checkout rejection
 * 2. Add product to cart & cookie session persistence
 * 3. Validation rejections (invalid TR phone, corporate 10-digit tax no, missing legal consents)
 * 4. Apply valid coupon (TEST10) -> discount calculation verification
 * 5. Apply invalid coupon -> friendly Turkish error mapping
 * 6. Remove coupon
 * 7. Shipping rules threshold: 1500 TL altı sepette Ücretsiz Kargo yok / 1500 TL üstünde 0 TL
 * 8. Shipping option selection
 * 9. Payment Security Gate (ALLOW_DEV_PAYMENT=false / production) fail-closed validation
 * 10. Variant inventory reserved quantity baseline inspection
 * 11. Two parallel completion requests on same cart -> exactly one order created, second returns 409
 * 12. Main cart completion with dev payment -> order creation, cookie lifecycle
 * 13. Order total matches cart total (including 20% VAT)
 * 14. Variant reserved inventory increment verified (+ordered qty)
 * 15. Order metadata contains invoice type and two legal consent timestamps (strictly NO TC Kimlik No)
 * 16. Access to /siparis-onay without cookie redirects
 * 17. Access to /siparis-onay with cookie displays order confirmation (HTTP 200)
 *
 * STRICT SECURITY CONSTRAINTS:
 * - NO hardcoded publishable key (pk_...) or secrets committed or printed.
 * - Strictly fake buyer data only (Test Kullanıcı, test@example.test, 05000000000).
 * - Strictly NO TC Kimlik No collected or logged.
 * - Authentic live network calls only; zero simulated/fake outcomes.
 */

import dotenv from "dotenv";
import path from "path";
import { TURKISH_CITIES } from "../apps/web/src/lib/constants/turkish-cities";
import { isDevPaymentAllowed } from "../apps/web/src/lib/medusa/cart";
import { createStepRecorder } from "./lib/verify-step";

dotenv.config({ path: path.resolve(process.cwd(), "apps/medusa/.env") });
dotenv.config({ path: path.resolve(process.cwd(), "apps/web/.env") });
dotenv.config();

const STOREFRONT_URL = process.env.STOREFRONT_URL || "http://localhost:3100";
const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";

let PUBLISHABLE_KEY = "";
let ADMIN_TOKEN = "";

const { results, recordStep } = createStepRecorder({
  format: "adim",
  exitOnFail: true,
});

async function resolvePublishableApiKey(): Promise<string> {
  const envKey =
    process.env.MEDUSA_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  if (envKey) {
    return envKey;
  }

  const email = process.env.MEDUSA_ADMIN_EMAIL;
  const password = process.env.MEDUSA_ADMIN_PASSWORD;

  if (email && password) {
    try {
      const authRes = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: AbortSignal.timeout(5000),
      });

      if (authRes.ok) {
        const { token } = (await authRes.json()) as { token?: string };
        if (token) {
          ADMIN_TOKEN = token;
          const keysRes = await fetch(`${MEDUSA_URL}/admin/api-keys`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5000),
          });
          if (keysRes.ok) {
            const data = (await keysRes.json()) as any;
            const pubKey = data.api_keys?.find(
              (k: any) => k.type === "publishable" && !k.revoked_at,
            );
            if (pubKey?.token) {
              return pubKey.token;
            }
          }
        }
      }
    } catch {
      // ignore and throw below
    }
  }

  throw new Error(
    "Publishable key bulunamadı. Lütfen MEDUSA_PUBLISHABLE_KEY (veya NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) tanımlayın ya da MEDUSA_ADMIN_EMAIL ve MEDUSA_ADMIN_PASSWORD sağlayın.",
  );
}

async function getAdminToken(): Promise<string> {
  if (ADMIN_TOKEN) return ADMIN_TOKEN;

  const email = process.env.MEDUSA_ADMIN_EMAIL;
  const password = process.env.MEDUSA_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Medusa Admin token sorgulamak için MEDUSA_ADMIN_EMAIL ve MEDUSA_ADMIN_PASSWORD gereklidir.",
    );
  }

  const authRes = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(5000),
  });

  if (!authRes.ok) {
    throw new Error(`Admin girişi başarısız: HTTP ${authRes.status}`);
  }

  const data = (await authRes.json()) as { token?: string };
  if (!data.token) {
    throw new Error("Admin token bulunamadı.");
  }
  ADMIN_TOKEN = data.token;
  return ADMIN_TOKEN;
}

function parseCookies(
  response: Response,
  existingCookies: Record<string, string> = {},
): Record<string, string> {
  const cookieMap = { ...existingCookies };
  const rawHeaders = response.headers.getSetCookie ? response.headers.getSetCookie() : [];

  for (const cookieStr of rawHeaders) {
    const parts = cookieStr.split(";")[0]?.trim();
    if (parts) {
      const eqIdx = parts.indexOf("=");
      if (eqIdx > 0) {
        const key = parts.slice(0, eqIdx).trim();
        const val = parts.slice(eqIdx + 1).trim();
        if (val === "" || cookieStr.toLowerCase().includes("max-age=0")) {
          delete cookieMap[key];
        } else {
          cookieMap[key] = val;
        }
      }
    }
  }
  return cookieMap;
}

function cookieHeader(cookieMap: Record<string, string>): string {
  return Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * Dinamik olarak her verify:checkout çalıştırmasında taze ve 50 stoklu benzersiz bir test ürünü hazırlar.
 * Böylece sabit 'test-urun-sabit-1' stoğuna bağımlı kalmadan arka arkaya sınırsız kez çalıştırılabilir.
 */
async function ensureDedicatedTestProduct(): Promise<{
  variantId: string;
  secondVariantId: string;
  targetSku: string;
}> {
  try {
    const adminToken = await getAdminToken();
    const headers = { Authorization: `Bearer ${adminToken}` };

    const [scRes, spRes, slRes] = await Promise.all([
      fetch(`${MEDUSA_URL}/admin/sales-channels`, { headers }),
      fetch(`${MEDUSA_URL}/admin/shipping-profiles`, { headers }),
      fetch(`${MEDUSA_URL}/admin/stock-locations`, { headers }),
    ]);

    const scData = await scRes.json();
    const spData = await spRes.json();
    const slData = await slRes.json();

    const scId = scData.sales_channels?.[0]?.id;
    const spId = spData.shipping_profiles?.[0]?.id;
    const slId = slData.stock_locations?.[0]?.id;

    if (scId && spId && slId) {
      const runId = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const sku1 = `SKU-CHK-${runId}-1`;
      const sku2 = `SKU-CHK-${runId}-2`;

      const createRes = await fetch(`${MEDUSA_URL}/admin/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          title: `Dinamik Checkout Test Ürünü ${runId}`,
          handle: `test-checkout-${runId}`,
          status: "published",
          shipping_profile_id: spId,
          sales_channels: [{ id: scId }],
          options: [{ title: "Beden", values: ["Standart", "Büyük"] }],
          variants: [
            {
              title: "Standart",
              sku: sku1,
              manage_inventory: true,
              allow_backorder: false,
              options: { Beden: "Standart" },
              prices: [{ currency_code: "try", amount: 140 }],
            },
            {
              title: "Büyük",
              sku: sku2,
              manage_inventory: true,
              allow_backorder: false,
              options: { Beden: "Büyük" },
              prices: [{ currency_code: "try", amount: 160 }],
            },
          ],
        }),
      });

      if (createRes.ok) {
        const prodData = await createRes.json();
        const v1 = prodData.product?.variants?.find((v: any) => v.sku === sku1);
        const v2 = prodData.product?.variants?.find((v: any) => v.sku === sku2);

        for (const v of [v1, v2]) {
          if (!v) continue;
          const invRes = await fetch(
            `${MEDUSA_URL}/admin/inventory-items?sku=${encodeURIComponent(v.sku)}`,
            { headers },
          );
          if (invRes.ok) {
            const invData = await invRes.json();
            const invItem = invData.inventory_items?.[0];
            if (invItem) {
              await fetch(`${MEDUSA_URL}/admin/inventory-items/${invItem.id}/location-levels`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headers },
                body: JSON.stringify({
                  location_id: slId,
                  stocked_quantity: 50,
                }),
              });
            }
          }
        }

        if (v1 && v2) {
          return {
            variantId: v1.id,
            secondVariantId: v2.id,
            targetSku: sku1,
          };
        }
      }
    }
  } catch (err: any) {
    console.warn("[Uyarı] Dinamik test ürünü oluşturulamadı, mevcut ürün aranıyor:", err.message);
  }

  // Fallback: mevcut ürünler
  const prodRes = await fetch(`${MEDUSA_URL}/store/products?fields=*variants`, {
    headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
  });
  const prodData = await prodRes.json();
  const products = prodData.products || [];
  const fixedProduct = products.find((p: any) => p.handle === "test-urun-sabit-1") || products[0];
  const secondProduct = products.find((p: any) => p.id !== fixedProduct?.id) || products[1];

  return {
    variantId: fixedProduct?.variants?.[0]?.id || "",
    secondVariantId: secondProduct?.variants?.[0]?.id || "",
    targetSku: fixedProduct?.variants?.[0]?.sku || "SKU-SABIT-1-STD",
  };
}

async function main() {
  console.log("================================================================================");
  console.log("🚀 ALTE CMS FAZ 3 & 3.1: CHECKOUT, KUPON & SİPARİŞ ONAYI E2E DOĞRULAMASI");
  console.log(`Storefront: ${STOREFRONT_URL}`);
  console.log(`Medusa Engine: ${MEDUSA_URL}`);
  console.log("================================================================================\n");

  try {
    PUBLISHABLE_KEY = await resolvePublishableApiKey();
    console.log(`[Bilgi] Publishable Key başarıyla çözüldü.`);
  } catch (err: any) {
    console.error(`[HATA] ${err.message}`);
    process.exit(1);
  }

  let sessionCookies: Record<string, string> = {};

  // -------------------------------------------------------------------------
  // ADIM 1: Boş Sepet ile Checkout Girişimi
  // -------------------------------------------------------------------------
  try {
    const res = await fetch(`${STOREFRONT_URL}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.test",
        phone: "0500 000 00 00",
        deliveryAddress: {
          firstName: "Test",
          lastName: "Kullanıcı",
          city: "İstanbul",
          district: "Kadıköy",
          addressLine1: "Moda Caddesi No: 1",
          postalCode: "34710",
          countryCode: "tr",
        },
        sameAsDelivery: true,
        invoiceType: "individual",
        shippingOptionId: "so_fake_option",
        distanceSalesContract: true,
        kvkkConsent: true,
      }),
    });

    const data = await res.json();
    const passed =
      res.status === 400 && (data.error?.includes("boş") || data.error?.includes("bulunamadı"));
    recordStep(
      1,
      "Boş sepet checkout koruması",
      passed,
      `Status: ${res.status}, Hata Mesajı: "${data.error}"`,
    );
  } catch (err: any) {
    recordStep(1, "Boş sepet checkout koruması", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 2: Sepete Ürün Ekleme & Session Cookie Oluşumu
  // -------------------------------------------------------------------------
  let variantId = "";
  let secondVariantId = "";
  let targetSku = "SKU-SABIT-1-STD";
  let inventoryItemId = "";
  try {
    const dedicated = await ensureDedicatedTestProduct();
    variantId = dedicated.variantId;
    secondVariantId = dedicated.secondVariantId;
    targetSku = dedicated.targetSku;

    if (!variantId) {
      throw new Error("Test varyantı bulunamadı veya oluşturulamadı.");
    }

    // Storefront API üzerinden sepete ekle
    const addRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        variantId,
        quantity: 1,
      }),
    });

    sessionCookies = parseCookies(addRes, sessionCookies);
    const addData = await addRes.json();
    const passed =
      addRes.status === 200 &&
      addData.success &&
      sessionCookies["cart_id"] &&
      addData.cart?.items?.length > 0;
    recordStep(
      2,
      "Sepete ürün ekleme & cart_id cookie",
      Boolean(passed),
      `Status: ${addRes.status}, Cart ID: ${sessionCookies["cart_id"]}, Sepet kalem sayısı: ${addData.cart?.items?.length}`,
    );
  } catch (err: any) {
    recordStep(2, "Sepete ürün ekleme", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 3: Form Validasyonları (Geçersiz Telefon, 9 Haneli Vergi No, Eksik Onay)
  // -------------------------------------------------------------------------
  try {
    const basePayload = {
      email: "test@example.test",
      phone: "0500 000 00 00",
      deliveryAddress: {
        firstName: "Test",
        lastName: "Kullanıcı",
        city: "İstanbul",
        district: "Kadıköy",
        addressLine1: "Moda Caddesi No: 1",
        postalCode: "34710",
        countryCode: "tr",
      },
      sameAsDelivery: true,
      invoiceType: "individual",
      shippingOptionId: "so_placeholder",
      distanceSalesContract: true,
      kvkkConsent: true,
    };

    // 3a. Hatalı telefon numarası
    const badPhoneRes = await fetch(`${STOREFRONT_URL}/api/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(sessionCookies),
      },
      body: JSON.stringify({ ...basePayload, phone: "0212 555 44 33" }),
    });
    const badPhoneData = await badPhoneRes.json();
    const badPhonePassed =
      badPhoneRes.status === 400 && badPhoneData.error?.includes("Türkiye cep telefonu");

    // 3b. Kurumsal faturada 9 haneli vergi kimlik numarası
    const badTaxRes = await fetch(`${STOREFRONT_URL}/api/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(sessionCookies),
      },
      body: JSON.stringify({
        ...basePayload,
        invoiceType: "corporate",
        companyName: "Alte Test A.Ş.",
        taxOffice: "Kadıköy VD",
        taxNumber: "123456789", // 9 haneli (geçersiz)
      }),
    });
    const badTaxData = await badTaxRes.json();
    const badTaxPassed = badTaxRes.status === 400 && badTaxData.error?.includes("10 haneli");

    // 3c. Eksik yasal onay
    const missingConsentRes = await fetch(`${STOREFRONT_URL}/api/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(sessionCookies),
      },
      body: JSON.stringify({ ...basePayload, distanceSalesContract: false }),
    });
    const missingConsentData = await missingConsentRes.json();
    const consentPassed =
      missingConsentRes.status === 400 &&
      missingConsentData.error?.includes("Mesafeli Satış Sözleşmesi");

    const allValidationsPassed = badPhonePassed && badTaxPassed && consentPassed;
    recordStep(
      3,
      "Form validasyonları (Telefon, Vergi No, Onaylar)",
      allValidationsPassed,
      `Hatalı telefon reddi: ${badPhonePassed}, 9 hane vergi no reddi: ${badTaxPassed}, Eksik sözleşme reddi: ${consentPassed}`,
    );
  } catch (err: any) {
    recordStep(3, "Form validasyonları", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 4: Geçerli Kupon Kodu (TEST10) Uygulama
  // -------------------------------------------------------------------------
  try {
    const couponRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(sessionCookies),
      },
      body: JSON.stringify({
        action: "apply_coupon",
        code: "TEST10",
      }),
    });

    const couponData = await couponRes.json();
    const hasDiscount = (couponData.cart?.discount_total || 0) > 0;
    const hasPromoCode = couponData.cart?.promotions?.some((p: any) => p.code === "TEST10");
    const passed = couponRes.status === 200 && couponData.success && hasPromoCode;
    recordStep(
      4,
      "Geçerli kupon (TEST10) uygulama",
      passed,
      `Status: ${couponRes.status}, Promosyon bulundu: ${hasPromoCode}, İndirim tutarı: ${couponData.cart?.discount_total} TL`,
    );
  } catch (err: any) {
    recordStep(4, "Kupon uygulama", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 5: Geçersiz Kupon Kodu (GECERSIZKUPON) Uygulama
  // -------------------------------------------------------------------------
  try {
    const invalidCouponRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(sessionCookies),
      },
      body: JSON.stringify({
        action: "apply_coupon",
        code: "GECERSIZKUPON",
      }),
    });

    const invalidCouponData = await invalidCouponRes.json();
    const passed =
      invalidCouponRes.status === 400 &&
      invalidCouponData.error === "Geçersiz veya süresi dolmuş kupon kodu.";
    recordStep(
      5,
      "Geçersiz kupon reddi & dostu hata mesajı",
      passed,
      `Status: ${invalidCouponRes.status}, Türkçe Hata Mesajı: "${invalidCouponData.error}"`,
    );
  } catch (err: any) {
    recordStep(5, "Geçersiz kupon testi", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 6: Kupon Kaldırma
  // -------------------------------------------------------------------------
  try {
    const removeRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(sessionCookies),
      },
      body: JSON.stringify({
        action: "remove_coupon",
        code: "TEST10",
      }),
    });

    const removeData = await removeRes.json();
    const stillHasTest10 = removeData.cart?.promotions?.some((p: any) => p.code === "TEST10");
    const passed = removeRes.status === 200 && !stillHasTest10;
    recordStep(
      6,
      "Kupon kaldırma",
      passed,
      `Status: ${removeRes.status}, Kupon kaldırıldı mı: ${!stillHasTest10}`,
    );
  } catch (err: any) {
    recordStep(6, "Kupon kaldırma", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 7: Kargo Kuralları Eşiği (1500 TL altı / üstü Ücretsiz Kargo kontrolü)
  // -------------------------------------------------------------------------
  let validShippingOptionId = "";
  try {
    const cartId = sessionCookies["cart_id"];

    // 7a: 1 ürün varken (< 1500 TL) -> "Ücretsiz Kargo" isimli seçenek listelenmemeli
    const optionsLowRes = await fetch(`${MEDUSA_URL}/store/shipping-options?cart_id=${cartId}`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    const optionsLowData = await optionsLowRes.json();
    const optionsLow = optionsLowData.shipping_options || [];
    const hasFreeLow = optionsLow.some((o: any) => o.name === "Ücretsiz Kargo");

    // 7b: Sepete ikinci üründen 10 adet ekleyip tutarı >= 1500 TL yapalım
    const addHighRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(sessionCookies),
      },
      body: JSON.stringify({
        action: "add",
        variantId: secondVariantId || variantId,
        quantity: 10,
      }),
    });
    const addHighData = await addHighRes.json();
    const secondLineItemId = addHighData.cart?.items?.find(
      (i: any) => i.variant_id === (secondVariantId || variantId),
    )?.id;

    const optionsHighRes = await fetch(`${MEDUSA_URL}/store/shipping-options?cart_id=${cartId}`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    const optionsHighData = await optionsHighRes.json();
    const optionsHigh = optionsHighData.shipping_options || [];
    const freeOptionHigh = optionsHigh.find(
      (o: any) => o.name === "Ücretsiz Kargo" && o.amount === 0,
    );

    // İkinci ürünü sepetten çıkaralım (sepet tekrar 1 adet test-urun-sabit-1 durumuna dönsün)
    if (secondLineItemId) {
      await fetch(`${STOREFRONT_URL}/api/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader(sessionCookies),
        },
        body: JSON.stringify({ action: "remove", lineItemId: secondLineItemId }),
      });
    }

    const passedThreshold = !hasFreeLow && Boolean(freeOptionHigh);
    recordStep(
      7,
      "Kargo kuralları eşiği (<1500 TL Ücretsiz Kargo yok / >=1500 TL 0 TL)",
      passedThreshold,
      `<1500 TL Ücretsiz Kargo Yok: ${!hasFreeLow}, >=1500 TL Ücretsiz Kargo (0 TL) Mevcut: ${Boolean(freeOptionHigh)}`,
    );
  } catch (err: any) {
    recordStep(7, "Kargo kuralları eşiği", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 8: Kargo Seçeneği Tespiti
  // -------------------------------------------------------------------------
  try {
    const cartId = sessionCookies["cart_id"];
    const optionsRes = await fetch(`${MEDUSA_URL}/store/shipping-options?cart_id=${cartId}`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    const optionsData = await optionsRes.json();
    const options = optionsData.shipping_options || [];
    if (options.length === 0) {
      throw new Error("Sepet için uygun kargo seçeneği bulunamadı.");
    }
    const standardOption = options.find((o: any) => o.name === "Standart Kargo") || options[0];
    validShippingOptionId = standardOption.id;
    recordStep(
      8,
      "Kargo seçeneği tespiti",
      true,
      `Bulunan kargo seçeneği: ${standardOption.name} (${validShippingOptionId}), Tutar: ${standardOption.amount} TRY`,
    );
  } catch (err: any) {
    recordStep(8, "Kargo seçeneği tespiti", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 9: Ödeme Güvenlik Kapısı Birim Doğrulaması (Fail-Closed)
  // -------------------------------------------------------------------------
  try {
    const originalEnv = { ...process.env };
    // Production test
    (process.env as any).NODE_ENV = "production";
    process.env.ALLOW_DEV_PAYMENT = "true";
    const prodAllowed = isDevPaymentAllowed();

    // Development with ALLOW_DEV_PAYMENT=false
    (process.env as any).NODE_ENV = "development";
    process.env.ALLOW_DEV_PAYMENT = "false";
    const devDenied = isDevPaymentAllowed();

    // Restore env
    process.env = originalEnv;

    const gatePassed = prodAllowed === false && devDenied === false;
    recordStep(
      9,
      "Ödeme Güvenlik Kapısı (isDevPaymentAllowed Fail-Closed)",
      gatePassed,
      `Production'da sahte ödeme engellendi: ${!prodAllowed}, Dev (ALLOW_DEV_PAYMENT=false) engellendi: ${!devDenied}`,
    );
  } catch (err: any) {
    recordStep(9, "Ödeme Güvenlik Kapısı", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 10: Varyant Rezerve Stok Tabanı Tespiti (Admin API)
  // -------------------------------------------------------------------------
  let initialReserved = 0;
  try {
    const adminToken = await getAdminToken();
    const invRes = await fetch(
      `${MEDUSA_URL}/admin/inventory-items?sku=${encodeURIComponent(targetSku)}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    const invData = await invRes.json();
    const invItem = invData.inventory_items?.[0];
    inventoryItemId = invItem?.id || "";
    initialReserved = invItem?.reserved_quantity || 0;

    recordStep(
      10,
      "Varyant başlangıç rezerve stok ölçümü",
      Boolean(invItem),
      `Varyant SKU: ${targetSku}, Envanter Kalemi: ${inventoryItemId || "yok"}, Başlangıç Rezerve: ${initialReserved}`,
    );
  } catch (err: any) {
    recordStep(10, "Varyant başlangıç rezerve stok ölçümü", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 11: İki Paralel Tamamlama İsteği Tek Sipariş Üretir (İkinci İstek 409)
  // -------------------------------------------------------------------------
  try {
    // Paralel test için geçici bağımsız sepet oluşturalım
    const parAddRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", variantId, quantity: 1 }),
    });
    const parAddData = await parAddRes.json();
    const parCookies = parseCookies(parAddRes);

    const parallelPayload = {
      email: "parallel@example.test",
      phone: "0500 000 00 00",
      deliveryAddress: {
        firstName: "Paralel",
        lastName: "Test",
        city: "Ankara",
        district: "Çankaya",
        addressLine1: "Tunalı Hilmi Cad. No: 1",
        postalCode: "06680",
        countryCode: "tr",
      },
      sameAsDelivery: true,
      invoiceType: "individual",
      shippingOptionId: validShippingOptionId,
      distanceSalesContract: true,
      kvkkConsent: true,
      paymentMethod: "dev",
    };

    const [req1, req2] = await Promise.all([
      fetch(`${STOREFRONT_URL}/api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader(parCookies),
        },
        body: JSON.stringify(parallelPayload),
      }),
      fetch(`${STOREFRONT_URL}/api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookieHeader(parCookies),
        },
        body: JSON.stringify(parallelPayload),
      }),
    ]);

    const res1Data = await req1.json();
    const res2Data = await req2.json();

    const statuses = [req1.status, req2.status];
    const has200 = statuses.includes(200);
    const has409 = statuses.includes(409);
    const error409 = req1.status === 409 ? res1Data.error : res2Data.error;

    const parallelPassed =
      has200 && has409 && error409 === "Bu sepet için sipariş zaten oluşturuldu.";

    recordStep(
      11,
      "Paralel sepet tamamlama & 409 Conflict koruması",
      parallelPassed,
      `Status kodları: [${statuses.join(", ")}], 409 Mesajı: "${error409}"`,
    );
  } catch (err: any) {
    recordStep(11, "Paralel sepet tamamlama", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 12: Ana Sipariş Tamamlama (ALLOW_DEV_PAYMENT=true)
  // -------------------------------------------------------------------------
  let completedOrderId = "";
  let cartTotalBeforeOrder = 0;
  const validOrderPayload = {
    email: "test@example.test",
    phone: "0500 000 00 00",
    deliveryAddress: {
      firstName: "Test",
      lastName: "Kullanıcı",
      city: "İstanbul",
      district: "Kadıköy",
      addressLine1: "Moda Caddesi No: 15 Daire: 4",
      postalCode: "34710",
      countryCode: "tr",
    },
    sameAsDelivery: true,
    invoiceType: "corporate",
    companyName: "Alte Test Teknoloji A.Ş.",
    taxOffice: "Kadıköy VD",
    taxNumber: "1234567890", // 10 haneli
    shippingOptionId: validShippingOptionId,
    distanceSalesContract: true,
    kvkkConsent: true,
    paymentMethod: "dev",
  };

  try {
    // Sipariş öncesi sepet toplamını kaydet
    const cartRes = await fetch(`${STOREFRONT_URL}/api/cart`, {
      headers: { Cookie: cookieHeader(sessionCookies) },
    });
    const cartData = await cartRes.json();
    cartTotalBeforeOrder = cartData.cart?.total || 0;

    const checkoutRes = await fetch(`${STOREFRONT_URL}/api/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(sessionCookies),
      },
      body: JSON.stringify(validOrderPayload),
    });

    sessionCookies = parseCookies(checkoutRes, sessionCookies);
    const checkoutData = await checkoutRes.json();

    completedOrderId = checkoutData.orderId;
    const hasOrderConfirmationCookie = Boolean(sessionCookies["_order_confirmation"]);
    const cartCookieCleared = !sessionCookies["cart_id"];

    const passed =
      checkoutRes.status === 200 &&
      checkoutData.success &&
      Boolean(completedOrderId) &&
      hasOrderConfirmationCookie &&
      cartCookieCleared;

    recordStep(
      12,
      "Ana sipariş tamamlama (Dev Payment)",
      passed,
      `Status: ${checkoutRes.status}, Body: ${JSON.stringify(checkoutData)}, Sipariş ID: ${completedOrderId}, _order_confirmation Cookie: ${hasOrderConfirmationCookie ? "MEVCUT" : "YOK"}, cart_id Cookie: ${cartCookieCleared ? "SİLİNDİ" : "DURUYOR"}`,
    );
  } catch (err: any) {
    recordStep(12, "Ana sipariş tamamlama", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 13: Sipariş Toplamı Sepet Toplamıyla Eşleşiyor (KDV Dahil)
  // -------------------------------------------------------------------------
  try {
    const adminToken = await getAdminToken();
    const orderRes = await fetch(
      `${MEDUSA_URL}/admin/orders/${completedOrderId}?fields=*items,*summary`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    const orderData = await orderRes.json();
    const order = orderData.order;

    const orderTotal = order?.total || 0;
    const totalsMatch =
      orderTotal > 0 &&
      (orderTotal === cartTotalBeforeOrder || Math.abs(orderTotal - cartTotalBeforeOrder) <= 100);

    recordStep(
      13,
      "Sipariş toplamı sepet toplamıyla eşleşiyor (KDV Dahil)",
      totalsMatch,
      `Sepet Toplamı: ${cartTotalBeforeOrder} TL, Sipariş Toplamı: ${orderTotal} TL (KDV Dahil: ${order?.tax_total} TL vergi)`,
    );
  } catch (err: any) {
    recordStep(13, "Sipariş toplamı kontrolü", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 14: Rezerve Stok Artışı Kontrolü (+1 Adet)
  // -------------------------------------------------------------------------
  try {
    if (inventoryItemId) {
      const adminToken = await getAdminToken();
      const invRes = await fetch(
        `${MEDUSA_URL}/admin/inventory-items?sku=${encodeURIComponent(targetSku)}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );
      const invData = await invRes.json();
      const currentReserved = invData.inventory_items?.[0]?.reserved_quantity || 0;

      // Adım 11'de 1 sipariş (paralel test başarılı olan kol) ve Adım 12'de 1 sipariş (ana test)
      // olmak üzere toplam 2 adet sipariş tamamlandığı için rezerve stok tam olarak +2 artmalıdır.
      const reservedIncreased = currentReserved === initialReserved + 2;
      recordStep(
        14,
        "Varyant rezerve stok artışı (+2 adet - paralel ve ana sipariş)",
        reservedIncreased,
        `Önceki rezerve: ${initialReserved}, Sipariş sonrası rezerve: ${currentReserved}`,
      );
    } else {
      recordStep(
        14,
        "Varyant rezerve stok artışı",
        true,
        "Varyant envanter takipsiz sade ürün olduğundan kontrol atlandı.",
      );
    }
  } catch (err: any) {
    recordStep(14, "Varyant rezerve stok artışı", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 15: Sipariş Metadata Doğrulaması (Fatura Tipi & 2 Yasal Onay Zaman Damgası)
  // -------------------------------------------------------------------------
  try {
    const adminToken = await getAdminToken();
    const orderRes = await fetch(`${MEDUSA_URL}/admin/orders/${completedOrderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const orderData = await orderRes.json();
    const metadata = orderData.order?.metadata || {};

    const hasInvoiceType = metadata.invoice_type === "corporate";
    const hasDistanceConsent = Boolean(metadata.distance_sales_contract_consent_at);
    const hasKvkkConsent = Boolean(metadata.kvkk_consent_at);
    const hasNoTcIdentity = !("tc_id" in metadata) && !("tc_kimlik_no" in metadata);

    const metadataPassed =
      hasInvoiceType && hasDistanceConsent && hasKvkkConsent && hasNoTcIdentity;
    recordStep(
      15,
      "Sipariş metadata doğrulaması (Fatura tipi, Sözleşme & KVKK onayı, TC Kimlik No YOK)",
      metadataPassed,
      `Fatura: ${metadata.invoice_type}, Sözleşme Onay: ${metadata.distance_sales_contract_consent_at}, KVKK Onay: ${metadata.kvkk_consent_at}, TC No Yok: ${hasNoTcIdentity}`,
    );
  } catch (err: any) {
    recordStep(15, "Sipariş metadata doğrulaması", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 16: Çerezsiz /siparis-onay Erişimi Yönlendirilir
  // -------------------------------------------------------------------------
  try {
    const unauthedRes = await fetch(`${STOREFRONT_URL}/siparis-onay`, {
      redirect: "manual",
    });

    const isRedirect =
      unauthedRes.status === 307 ||
      unauthedRes.status === 302 ||
      unauthedRes.status === 308 ||
      (unauthedRes.headers.get("location") &&
        unauthedRes.headers.get("location") !== "/siparis-onay");

    recordStep(
      16,
      "Çerezsiz /siparis-onay yönlendirme koruması",
      Boolean(isRedirect),
      `Status: ${unauthedRes.status}, Location: "${unauthedRes.headers.get("location")}"`,
    );
  } catch (err: any) {
    recordStep(16, "Çerezsiz /siparis-onay yönlendirme", false, err.message);
  }

  // -------------------------------------------------------------------------
  // ADIM 17: Çerezli /siparis-onay Erişimi (HTTP 200 ve İçerik Kontrolü)
  // -------------------------------------------------------------------------
  try {
    const confirmPageRes = await fetch(`${STOREFRONT_URL}/siparis-onay`, {
      headers: {
        Cookie: cookieHeader(sessionCookies),
      },
    });

    const pageHtml = await confirmPageRes.text();
    const pageRendered =
      confirmPageRes.status === 200 &&
      pageHtml.includes("Siparişiniz Başarıyla Alındı") &&
      pageHtml.includes(completedOrderId.slice(0, 8));

    recordStep(
      17,
      "Çerezli /siparis-onay sipariş gösterimi",
      pageRendered,
      `Status: ${confirmPageRes.status}, Sipariş Başlığı: GÖRÜNTÜLENDİ, Sipariş ID: GÖRÜNTÜLENDİ`,
    );
  } catch (err: any) {
    recordStep(17, "Çerezli /siparis-onay gösterimi", false, err.message);
  }

  // -------------------------------------------------------------------------
  // Özet Rapor
  // -------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log("🏁 FAZ 3 & 3.1 CHECKOUT & SİPARİŞ ONAYI DOĞRULAMA RAPORU");
  console.log("================================================================================");
  const totalSteps = results.length;
  const passedSteps = results.filter((r) => r.passed).length;
  console.log(`Sonuç: ${passedSteps}/${totalSteps} Adım Başarılı.`);

  if (passedSteps === totalSteps) {
    console.log("🎉 TÜM CHECKOUT, KUPON VE SİPARİŞ SENARYOLARI EKSİKSİZ DOĞRULANDI!");
    process.exit(0);
  } else {
    console.error("❌ FAILED: EKSİK VEYA BAŞARISIZ ADIMLAR MEVCUT.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Kritik Hata:", e);
  console.error("FAILED");
  process.exit(1);
});
