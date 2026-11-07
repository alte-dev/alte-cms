/**
 * scripts/seed-fake-catalog.ts
 * Generates synthetic / dummy products for testing and memory benchmarking.
 * STRICT SECURITY: Contains ZERO real customer, brand, or production data.
 * Usage:
 *   npx tsx scripts/seed-fake-catalog.ts --count 100
 *   npx tsx scripts/seed-fake-catalog.ts --count 1000
 */

import fs from "fs";
import path from "path";

const SIZES = ["S", "M", "L", "XL"];
const COLORS = ["Siyah", "Beyaz", "Mavi", "Gri", "Bej"];
const CATEGORIES = ["Giyim", "Aksesuar", "Ayakkabı", "Ev & Yaşam", "Spor"];

interface FakeProductVariant {
  title: string;
  sku: string;
  prices: Array<{
    amount: number;
    currency_code: string;
  }>;
  options: Record<string, string>;
  inventory_quantity: number;
}

interface FakeProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  category: string;
  thumbnail: string;
  variants: FakeProductVariant[];
}

export function generateFakeCatalog(count: number): FakeProduct[] {
  console.log(`🔨 Generating ${count} synthetic products for load testing...`);
  const products: FakeProduct[] = [];

  for (let i = 1; i <= count; i++) {
    const category = CATEGORIES[i % CATEGORIES.length];
    const basePrice = 100 + (i % 40) * 25; // 100 TL to 1100 TL
    const handle = `ornek-urun-${i}`;
    const title = `Örnek Test Ürünü #${i} (${category})`;

    const variants: FakeProductVariant[] = [];
    const color = COLORS[i % COLORS.length];

    for (const size of SIZES) {
      variants.push({
        title: `${color} / ${size}`,
        sku: `SKU-${i}-${color.substring(0, 2).toUpperCase()}-${size}`,
        prices: [
          {
            amount: basePrice,
            currency_code: "TRY",
          },
        ],
        options: {
          Renk: color,
          Beden: size,
        },
        inventory_quantity: 50,
      });
    }

    products.push({
      id: `prod_test_${i.toString().padStart(4, "0")}`,
      title,
      handle,
      description: `Bu ürün otomatik performans ve bellek ölçüm senaryosu için üretilmiş örnek test verisidir (#${i}).`,
      category,
      thumbnail: `https://images.example.com/placeholder/${i % 10}.jpg`,
      variants,
    });
  }

  return products;
}

async function main() {
  const args = process.argv.slice(2);
  const countIndex = args.indexOf("--count");
  const count =
    countIndex !== -1 && args[countIndex + 1] ? parseInt(args[countIndex + 1], 10) : 100;

  const catalog = generateFakeCatalog(count);

  const outDir = path.resolve(process.cwd(), "docs/measurements");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, `seed-catalog-${count}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ count: catalog.length, products: catalog }, null, 2));

  console.log(`✅ Generated ${catalog.length} synthetic products.`);
  console.log(`📁 Saved to: ${outFile}`);

  // If Medusa API is running, attempt to post to Medusa batch endpoint
  const medusaUrl = process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000";
  try {
    const health = await fetch(`${medusaUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (health.ok) {
      console.log(`⚡ Medusa API is online at ${medusaUrl}. Ready for catalog import.`);
    }
  } catch {
    console.log(
      `ℹ️ Medusa is currently offline. Seed file is ready on disk for import when Medusa starts.`,
    );
  }
}

if (process.argv[1]?.endsWith("seed-fake-catalog.ts")) {
  main().catch((err) => {
    console.error("❌ Catalog generation failed:", err);
    process.exit(1);
  });
}
