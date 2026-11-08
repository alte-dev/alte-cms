/**
 * scripts/benchmark-callback-lookup.ts
 *
 * FAZ 4.1 Item 5: Callback Lookup Performance Benchmark.
 * Compares Linear In-Memory Scan vs Direct Indexed Query on 2,000 payment sessions.
 */

import dotenv from "dotenv";
import path from "path";
import pg from "pg";

dotenv.config({ path: path.resolve(process.cwd(), "apps/medusa/.env") });

const DB_URL =
  process.env.DATABASE_URL || "postgres://medusa_user:medusa_password@127.0.0.1:5432/medusa_db";
const pool = new pg.Pool({ connectionString: DB_URL });

const SAMPLE_SIZE = 2000;
const BENCHMARK_PREFIX = `bench_${Date.now()}`;
const TARGET_INDEX = 1899;
const TARGET_OID = `${BENCHMARK_PREFIX}_oid_${TARGET_INDEX}`;

async function main() {
  console.log("===============================================================");
  console.log(` CALLBACK LOOKUP PERFORMANCE BENCHMARK (${SAMPLE_SIZE} SESSIONS)`);
  console.log("===============================================================\n");

  const client = await pool.connect();

  try {
    // 1. Ensure expression index exists
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_payment_session_merchant_oid ON payment_session (((data->>'merchant_oid'))) WHERE deleted_at IS NULL;",
    );

    // 2. Insert dummy payment collection & 2,000 mock payment sessions in a batch
    console.log(`2,000 adet test ödeme oturumu oluşturuluyor (Önek: ${BENCHMARK_PREFIX})...`);
    const colId = `paycol_${BENCHMARK_PREFIX}`;
    await client.query(
      `INSERT INTO payment_collection (id, currency_code, amount, raw_amount, status)
       VALUES ($1, 'TRY', 10000, '{"value": "10000", "precision": 20}'::jsonb, 'not_paid')
       ON CONFLICT (id) DO NOTHING;`,
      [colId],
    );

    // Chunked batch insertion (200 items per query)
    const CHUNK_SIZE = 200;
    for (let c = 0; c < SAMPLE_SIZE; c += CHUNK_SIZE) {
      const chunkPlaceholders: string[] = [];
      const chunkValues: any[] = [];
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const itemIdx = c + i;
        const sesId = `payses_${BENCHMARK_PREFIX}_${itemIdx}`;
        const oid = `${BENCHMARK_PREFIX}_oid_${itemIdx}`;
        const dataJson = JSON.stringify({
          merchant_oid: oid,
          cart_id: `cart_${BENCHMARK_PREFIX}_${itemIdx}`,
          expected_amount_kurus: 10000,
          benchmark_dummy_field: "x".repeat(200), // simulate realistic payload size
        });
        const p = i * 4;
        chunkPlaceholders.push(
          `($${p + 1}, $${p + 2}, 'TRY', 100, '{"value": "100", "precision": 20}'::jsonb, 'pp_paytr_paytr', $${p + 3}::jsonb, $${p + 4}, '{}'::jsonb)`,
        );
        chunkValues.push(sesId, colId, dataJson, "pending");
      }

      await client.query(
        `INSERT INTO payment_session (id, payment_collection_id, currency_code, amount, raw_amount, provider_id, data, status, context)
         VALUES ${chunkPlaceholders.join(", ")};`,
        chunkValues,
      );
    }
    console.log(
      `✅ 2,000 oturum veritabanına başarıyla yüklendi.\nHedef aranan merchant_oid: ${TARGET_OID}\n`,
    );

    // ----------------------------------------------------------------------
    // TEST 1: Linear In-Memory Scan (Old Faz 4 implementation)
    // ----------------------------------------------------------------------
    console.log("--- Yöntem 1: Belleğe Tüm Koleksiyonları Çekip Arama (Linear Memory Scan) ---");
    const iterations = 10;
    let linearTotalMs = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      // Fetch all sessions into memory
      const allRowsRes = await client.query(
        "SELECT id, payment_collection_id, data FROM payment_session WHERE deleted_at IS NULL;",
      );
      // In-memory linear scan
      let found: any = null;
      for (const row of allRowsRes.rows) {
        if (row.data?.merchant_oid === TARGET_OID) {
          found = row;
          break;
        }
      }
      const dur = performance.now() - start;
      linearTotalMs += dur;
      if (i === 0 && !found)
        throw new Error("Doğrulama hatası: Linear scan aranan oturumu bulamadı!");
    }

    const linearAvgMs = linearTotalMs / iterations;
    console.log(
      `Linear Scan Ortalama Süre: ${linearAvgMs.toFixed(2)} ms (${iterations} tekrar ortalaması)\n`,
    );

    // ----------------------------------------------------------------------
    // TEST 2: Direct Indexed Query (Faz 4.1 implementation)
    // ----------------------------------------------------------------------
    console.log("--- Yöntem 2: Doğrudan İndeksli SQL Sorgusu (Direct Indexed Query) ---");
    let indexedTotalMs = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const indexedRes = await client.query(
        "SELECT id, payment_collection_id, data FROM payment_session WHERE (data->>'merchant_oid') = $1 AND deleted_at IS NULL LIMIT 1;",
        [TARGET_OID],
      );
      const found = indexedRes.rows[0];
      const dur = performance.now() - start;
      indexedTotalMs += dur;
      if (i === 0 && !found)
        throw new Error("Doğrulama hatası: Indexed query aranan oturumu bulamadı!");
    }

    const indexedAvgMs = indexedTotalMs / iterations;
    console.log(
      `Indexed Query Ortalama Süre: ${indexedAvgMs.toFixed(2)} ms (${iterations} tekrar ortalaması)\n`,
    );

    // Explain query execution plan
    const explainRes = await client.query(
      "EXPLAIN ANALYZE SELECT id, payment_collection_id, data FROM payment_session WHERE (data->>'merchant_oid') = $1 AND deleted_at IS NULL LIMIT 1;",
      [TARGET_OID],
    );
    console.log("PostgreSQL Query Plan:");
    console.log(explainRes.rows.map((r) => r["QUERY PLAN"]).join("\n"));

    // ----------------------------------------------------------------------
    // Summary
    // ----------------------------------------------------------------------
    const speedup = linearAvgMs / indexedAvgMs;
    console.log("\n===============================================================");
    console.log(" BENCHMARK SONUÇLARI");
    console.log("===============================================================");
    console.log(`Oturum Sayısı (Dataset Size):       ${SAMPLE_SIZE.toLocaleString("tr-TR")}`);
    console.log(`Yöntem 1 (Linear Memory Scan):     ${linearAvgMs.toFixed(2)} ms`);
    console.log(`Yöntem 2 (Direct Indexed Query):   ${indexedAvgMs.toFixed(2)} ms`);
    console.log(`Hızlanma Çarpanı (Speedup):        ${speedup.toFixed(1)}x DAHA HIZLI`);
    console.log("===============================================================\n");
  } finally {
    // Cleanup benchmark dummy records
    console.log("Test kayıtları temizleniyor...");
    await client.query("DELETE FROM payment_session WHERE payment_collection_id = $1;", [
      `paycol_${BENCHMARK_PREFIX}`,
    ]);
    await client.query("DELETE FROM payment_collection WHERE id = $1;", [
      `paycol_${BENCHMARK_PREFIX}`,
    ]);
    console.log("✅ Temizlik tamamlandı.");
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Benchmark hatası:", err.message);
  process.exit(1);
});
