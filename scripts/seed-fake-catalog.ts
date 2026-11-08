/**
 * scripts/seed-fake-catalog.ts
 * Real Medusa v2 Catalog Seeding Script for Türkiye Store & Memory Testing.
 * STRICT SECURITY: Zero secrets, zero customer data, zero production server touch.
 *
 * Usage:
 *   npx tsx scripts/seed-fake-catalog.ts --count 100
 *   npx tsx scripts/seed-fake-catalog.ts --count 1000
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "apps/medusa/.env") });
dotenv.config();

const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";

export interface SeedProductInput {
  title: string;
  handle: string;
  description: string;
  status: "published";
  shipping_profile_id: string;
  sales_channels: Array<{ id: string }>;
  categories?: Array<{ id: string }>;
  collection_id?: string | null;
  type_id?: string | null;
  tags?: Array<{ id: string }>;
  options: Array<{
    title: string;
    values: string[];
  }>;
  variants: Array<{
    title: string;
    sku: string;
    manage_inventory: boolean;
    allow_backorder?: boolean;
    options: Record<string, string>;
    prices: Array<{
      currency_code: string;
      amount: number;
    }>;
  }>;
}

export interface SeedResult {
  success: boolean;
  created: number;
  failed: number;
  batchId: string;
}

const SIZES = ["S", "M", "L", "XL"];
const COLORS = ["Siyah", "Beyaz", "Mavi"];
const TAGS = ["organik", "yeni-sezon", "one-cikan"];

async function checkMedusaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${MEDUSA_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function getAdminToken(): Promise<string | null> {
  if (process.env.MEDUSA_ADMIN_TOKEN) {
    return process.env.MEDUSA_ADMIN_TOKEN;
  }

  const email = process.env.MEDUSA_ADMIN_EMAIL;
  const password = process.env.MEDUSA_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "❌ HATA: MEDUSA_ADMIN_EMAIL veya MEDUSA_ADMIN_PASSWORD ortam değişkenleri tanımlı değil.",
    );
    process.exit(1);
  }

  try {
    const res = await fetch(`${MEDUSA_URL}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string };
    return data.token || null;
  } catch {
    return null;
  }
}

interface StoreMetadata {
  salesChannelId: string;
  shippingProfileId: string;
  stockLocationId: string;
  categories: Array<{ id: string; name: string; handle: string }>;
  collections: Array<{ id: string; title: string; handle: string }>;
  types: Array<{ id: string; value: string }>;
  tags: Array<{ id: string; value: string }>;
}

async function fetchStoreMetadata(token: string): Promise<StoreMetadata> {
  const headers = { Authorization: `Bearer ${token}` };

  const [scRes, spRes, slRes, catRes, colRes, typeRes, tagRes] = await Promise.all([
    fetch(`${MEDUSA_URL}/admin/sales-channels`, { headers }),
    fetch(`${MEDUSA_URL}/admin/shipping-profiles`, { headers }),
    fetch(`${MEDUSA_URL}/admin/stock-locations`, { headers }),
    fetch(`${MEDUSA_URL}/admin/product-categories?limit=50`, { headers }),
    fetch(`${MEDUSA_URL}/admin/collections?limit=50`, { headers }),
    fetch(`${MEDUSA_URL}/admin/product-types?limit=50`, { headers }),
    fetch(`${MEDUSA_URL}/admin/product-tags?limit=50`, { headers }),
  ]);

  const scData = (await scRes.json()) as any;
  const spData = (await spRes.json()) as any;
  const slData = (await slRes.json()) as any;
  const catData = (await catRes.json()) as any;
  const colData = (await colRes.json()) as any;
  const typeData = (await typeRes.json()) as any;
  const tagData = (await tagRes.json()) as any;

  const salesChannel =
    scData.sales_channels?.find((sc: any) => sc.name === "Web Mağaza") ||
    scData.sales_channels?.[0];
  const shippingProfile =
    spData.shipping_profiles?.find(
      (sp: any) => sp.type === "default" || sp.name === "Varsayılan",
    ) || spData.shipping_profiles?.[0];
  const stockLocation =
    slData.stock_locations?.find((sl: any) => sl.name === "Ana Depo") ||
    slData.stock_locations?.[0];

  if (!salesChannel || !shippingProfile || !stockLocation) {
    throw new Error(
      "Mağaza önkoşulları eksik. Lütfen önce 'pnpm setup:store' komutunu çalıştırın.",
    );
  }

  return {
    salesChannelId: salesChannel.id,
    shippingProfileId: shippingProfile.id,
    stockLocationId: stockLocation.id,
    categories: (catData.product_categories || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      handle: c.handle,
    })),
    collections: (colData.collections || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      handle: c.handle,
    })),
    types: (typeData.product_types || []).map((t: any) => ({
      id: t.id,
      value: t.value,
    })),
    tags: (tagData.product_tags || []).map((t: any) => ({
      id: t.id,
      value: t.value,
    })),
  };
}

export function generateSeedPayload(
  count: number,
  metadata: StoreMetadata,
  batchId = Date.now().toString(36),
): SeedProductInput[] {
  const products: SeedProductInput[] = [];

  for (let i = 1; i <= count; i++) {
    const handle = i === 1 ? "test-urun-sabit-1" : `test-urun-${batchId}-${i}`;
    const basePrice = 150 + (i % 30) * 25; // in TRY decimal
    const category =
      metadata.categories.length > 0
        ? metadata.categories[i % metadata.categories.length]
        : undefined;
    const collection =
      metadata.collections.length > 0
        ? metadata.collections[i % metadata.collections.length]
        : undefined;
    const tag = metadata.tags.length > 0 ? metadata.tags[i % metadata.tags.length] : undefined;

    // Every 5th product has KDV 10% (food type), every 15th has KDV 1% (special type)
    let typeId: string | null = null;
    if (i % 15 === 0) {
      typeId = metadata.types.find((t) => t.value === "special")?.id || null;
    } else if (i % 5 === 0) {
      typeId = metadata.types.find((t) => t.value === "food")?.id || null;
    }

    // Determine product pattern:
    // i === 1: Fixed sample product with single variant and stock = 5 for deterministic tests
    // i % 3 !== 1: Simple product (single default variant)
    // i % 3 === 1 (i > 1): Variant product (Beden / Renk variants)
    const isSimple = i === 1 || i % 3 !== 1;

    if (isSimple) {
      products.push({
        title:
          i === 1
            ? "Örnek Sabit Test Ürünü #1"
            : `Örnek Sade Ürün #${i} ${category ? `(${category.name})` : ""}`,
        handle,
        description:
          i === 1
            ? "Deterministik vitrin ve stok testleri için sabit test ürünü #1."
            : `Otomatik katalog testi için sade ürün #${i} (Batch: ${batchId}).`,
        status: "published",
        shipping_profile_id: metadata.shippingProfileId,
        sales_channels: [{ id: metadata.salesChannelId }],
        categories: category ? [{ id: category.id }] : undefined,
        collection_id: collection ? collection.id : null,
        type_id: typeId,
        tags: tag ? [{ id: tag.id }] : undefined,
        options: [{ title: "Varsayılan", values: ["Standart"] }],
        variants: [
          {
            title: "Standart",
            sku: i === 1 ? "SKU-SABIT-1-STD" : `SKU-${batchId}-${i}-STD`,
            manage_inventory: true,
            allow_backorder: false,
            options: { Varsayılan: "Standart" },
            prices: [
              {
                currency_code: "try",
                amount: basePrice,
              },
            ],
          },
        ],
      });
    } else {
      // Variant product (3 colors x 2 sizes)
      const selectedSizes = SIZES.slice(0, 2);
      const variants: SeedProductInput["variants"] = [];

      for (const color of COLORS) {
        for (const size of selectedSizes) {
          variants.push({
            title: `${color} / ${size}`,
            sku: `SKU-${batchId}-${i}-${color.substring(0, 2).toUpperCase()}-${size}`,
            manage_inventory: true,
            allow_backorder: false,
            options: {
              Renk: color,
              Beden: size,
            },
            prices: [
              {
                currency_code: "try",
                amount: basePrice,
              },
            ],
          });
        }
      }

      products.push({
        title: `Örnek Varyantlı Ürün #${i} ${category ? `(${category.name})` : ""}`,
        handle,
        description: `Otomatik katalog testi için çok varyantlı ürün #${i} (Batch: ${batchId}).`,
        status: "published",
        shipping_profile_id: metadata.shippingProfileId,
        sales_channels: [{ id: metadata.salesChannelId }],
        categories: category ? [{ id: category.id }] : undefined,
        collection_id: collection ? collection.id : null,
        type_id: typeId,
        tags: tag ? [{ id: tag.id }] : undefined,
        options: [
          { title: "Renk", values: COLORS },
          { title: "Beden", values: selectedSizes },
        ],
        variants,
      });
    }
  }

  return products;
}

export async function seedProducts(
  count: number,
  onProgress?: (created: number, total: number, failed: number) => void,
): Promise<SeedResult> {
  const isHealthy = await checkMedusaHealth();
  if (!isHealthy) {
    console.error(`❌ HATA: Medusa sunucusuna (${MEDUSA_URL}) erişilemedi.`);
    console.error("Lütfen önce Docker konteynerlerini ve Medusa sunucusunu başlatın.");
    process.exit(1);
  }

  const token = await getAdminToken();
  if (!token) {
    console.error("❌ HATA: Medusa Admin yetkilendirmesi başarısız oldu.");
    process.exit(1);
  }

  console.log("🔍 Mağaza meta verileri alınıyor (kanallar, profiller, konumlar)...");
  const metadata = await fetchStoreMetadata(token);

  console.log(`🚀 ${count} adet test ürünü Medusa v2 API'sine aktarılıyor (Batch bazlı)...`);
  const batchId = Date.now().toString(36);
  const payloads = generateSeedPayload(count, metadata, batchId);
  let created = 0;
  let failed = 0;

  const createdVariantIdsForDiscount: Array<{ id: string; price: number }> = [];

  for (let i = 0; i < payloads.length; i++) {
    const product = payloads[i];
    try {
      if (product.handle === "test-urun-sabit-1") {
        try {
          const checkRes = await fetch(
            `${MEDUSA_URL}/admin/products?handle[]=test-urun-sabit-1&fields=*variants`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (checkRes.ok) {
            const checkData = (await checkRes.json()) as any;
            if (checkData.products && checkData.products.length > 0) {
              created++;
              continue; // test-urun-sabit-1 is already present in DB
            }
          }
        } catch {
          // ignore check error and proceed
        }
      }

      const res = await fetch(`${MEDUSA_URL}/admin/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(product),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        created++;
        const prodData = (await res.json()) as any;
        const variants = prodData.product?.variants || [];

        // Set inventory level for each variant at Ana Depo
        for (let vIdx = 0; vIdx < variants.length; vIdx++) {
          const variant = variants[vIdx];
          // First product has exactly 5 units (for exact N+1 insufficient inventory test)
          // Last product has 0 stock (out-of-stock test), others have 50 units
          const isOutOfStock = i === payloads.length - 1;
          const stockedQuantity = isOutOfStock ? 0 : i === 0 ? 5 : 50;

          try {
            // Find inventory item by SKU
            const invRes = await fetch(`${MEDUSA_URL}/admin/inventory-items?sku=${variant.sku}`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(5000),
            });
            if (invRes.ok) {
              const invData = (await invRes.json()) as any;
              const invItem = invData.inventory_items?.[0];
              if (invItem) {
                await fetch(`${MEDUSA_URL}/admin/inventory-items/${invItem.id}/location-levels`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    location_id: metadata.stockLocationId,
                    stocked_quantity: stockedQuantity,
                  }),
                  signal: AbortSignal.timeout(5000),
                });
              }
            }
          } catch {
            // Non-fatal for individual inventory level
          }

          // Pick some variants for discount price list
          if (i % 10 === 0 && vIdx === 0) {
            const originalPrice = variant.prices?.[0]?.amount || 150;
            createdVariantIdsForDiscount.push({
              id: variant.id,
              price: Math.round(originalPrice * 0.8), // 20% discount
            });
          }
        }

        if (created % 25 === 0 || created === count) {
          console.log(`   İlerleme: ${created}/${count} ürün yüklendi ve envanter bağlandı.`);
        }
      } else {
        failed++;
        const errorText = await res.text();
        console.error(`   ⚠️ Ürün #${i + 1} yüklenemedi: ${res.status} - ${errorText}`);
      }
    } catch (err: any) {
      failed++;
      console.error(`   ⚠️ Ürün #${i + 1} isteği zaman aşımına uğradı: ${err.message}`);
    }

    if (onProgress) {
      onProgress(created, count, failed);
    }
  }

  // Create Sale Price List for discounted products
  if (createdVariantIdsForDiscount.length > 0) {
    try {
      console.log(
        `🏷️ ${createdVariantIdsForDiscount.length} ürün için İndirim Fiyat Listesi (Sale Price List) oluşturuluyor...`,
      );
      await fetch(`${MEDUSA_URL}/admin/price-lists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: `Kampanya İndirimi (${batchId})`,
          description: "Seçili ürünlerde %20 indirim",
          status: "active",
          type: "sale",
          prices: createdVariantIdsForDiscount.map((d) => ({
            currency_code: "try",
            amount: d.price,
            variant_id: d.id,
          })),
        }),
        signal: AbortSignal.timeout(8000),
      });
      console.log("   ✅ İndirim fiyat listesi başarıyla etkinleştirildi.");
    } catch (err: any) {
      console.warn(`   ⚠️ Fiyat listesi uyarısı: ${err.message}`);
    }
  }

  console.log(`✅ Tamamlandı: Toplam ${created}/${count} ürün aktarıldı (Başarısız: ${failed}).`);
  return { success: failed === 0 && created === count, created, failed, batchId };
}

async function main() {
  const args = process.argv.slice(2);
  const countIndex = args.indexOf("--count");
  const count =
    countIndex !== -1 && args[countIndex + 1] ? parseInt(args[countIndex + 1], 10) : 100;

  await seedProducts(count);
}

if (process.argv[1]?.endsWith("seed-fake-catalog.ts")) {
  main().catch((err) => {
    console.error("❌ Beklenmeyen hata:", err);
    process.exit(1);
  });
}
