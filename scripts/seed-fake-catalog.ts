/**
 * scripts/seed-fake-catalog.ts
 * Real Medusa v2 Catalog Seeding Script for Load & Memory Testing.
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
  options: Array<{
    title: string;
    values: string[];
  }>;
  variants: Array<{
    title: string;
    sku: string;
    manage_inventory: boolean;
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
}

const CATEGORIES = ["Giyim", "Aksesuar", "Ayakkabı", "Ev & Yaşam", "Spor"];
const SIZES = ["S", "M", "L", "XL"];
const COLORS = ["Siyah", "Beyaz", "Mavi"];

export function generateSeedPayload(
  count: number,
  batchId = Date.now().toString(36),
): SeedProductInput[] {
  const products: SeedProductInput[] = [];

  for (let i = 1; i <= count; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const basePrice = (100 + (i % 40) * 25) * 100; // in kuruş (Medusa smallest unit)
    const handle = `test-urun-${batchId}-${i}`;
    const title = `Örnek Test Ürünü #${i} (${category})`;

    const variants: SeedProductInput["variants"] = [];

    for (const color of COLORS) {
      for (const size of SIZES) {
        variants.push({
          title: `${color} / ${size}`,
          sku: `SKU-${batchId}-${i}-${color.substring(0, 2).toUpperCase()}-${size}`,
          manage_inventory: false,
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
      title,
      handle,
      description: `Otomatik bellek ve yük testi için sentetik ürün verisi #${i} (Batch: ${batchId}).`,
      status: "published",
      options: [
        { title: "Renk", values: COLORS },
        { title: "Beden", values: SIZES },
      ],
      variants,
    });
  }

  return products;
}

async function checkMedusaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${MEDUSA_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function getAdminToken(): Promise<string | null> {
  // If an API token is provided via env
  if (process.env.MEDUSA_ADMIN_TOKEN) {
    return process.env.MEDUSA_ADMIN_TOKEN;
  }

  const email = process.env.MEDUSA_ADMIN_EMAIL;
  const password = process.env.MEDUSA_ADMIN_PASSWORD;

  // STRICT REQUIREMENT: No hardcoded fallback credentials.
  if (!email || !password) {
    console.error(
      "❌ HATA: MEDUSA_ADMIN_EMAIL veya MEDUSA_ADMIN_PASSWORD ortam değişkenleri tanımlı değil.",
    );
    console.error(
      "Lütfen .env dosyasında MEDUSA_ADMIN_EMAIL ve MEDUSA_ADMIN_PASSWORD değerlerini sağlayın veya MEDUSA_ADMIN_TOKEN belirtin.",
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
    console.error("Lütfen geçerli MEDUSA_ADMIN_TOKEN veya dev admin kullanıcısını sağlayın.");
    process.exit(1);
  }

  console.log(`🚀 ${count} adet test ürünü Medusa v2 API'sine aktarılıyor...`);
  const batchId = Date.now().toString(36);
  const payloads = generateSeedPayload(count, batchId);
  let created = 0;
  let failed = 0;

  for (let i = 0; i < payloads.length; i++) {
    const product = payloads[i];
    try {
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
        if (created % 25 === 0 || created === count) {
          console.log(`   İlerleme: ${created}/${count} ürün yüklendi.`);
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

  console.log(`✅ Tamamlandı: Toplam ${created}/${count} ürün aktarıldı (Başarısız: ${failed}).`);
  return { success: failed === 0 && created === count, created, failed };
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
