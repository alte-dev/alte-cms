import type pg from "pg";

export async function runBatchTransaction<T>(
  pool: pg.Pool,
  batch: T[],
  handler: (client: pg.PoolClient, batch: T[]) => Promise<void>,
): Promise<void> {
  if (batch.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await handler(client, batch);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => null);
    throw err;
  } finally {
    client.release();
  }
}
