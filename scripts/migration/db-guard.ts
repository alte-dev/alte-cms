import type { MigrationDbGuardOptions } from "./types";

export function parseDatabaseNameFromUrl(databaseUrl: string): string | null {
  try {
    const parsed = new URL(databaseUrl);
    const dbName = parsed.pathname.replace(/^\/+/, "").trim();
    return dbName || null;
  } catch {
    return null;
  }
}

export function validateMigrationDbGuard(opts: MigrationDbGuardOptions): void {
  if (!opts.apply) return;

  const actualDb = parseDatabaseNameFromUrl(opts.databaseUrl);
  if (!actualDb) {
    throw new Error("DATABASE_URL içinden hedef veritabanı adı okunamadı.");
  }

  const confirmed = (opts.confirmDatabase ?? "").trim();
  if (!confirmed) {
    throw new Error(
      `--apply için --confirm-database <veritabanı_adı> zorunludur (beklenen: ${actualDb}).`,
    );
  }
  if (confirmed !== actualDb) {
    throw new Error(`--confirm-database eşleşmiyor: verilen '${confirmed}', hedef '${actualDb}'.`);
  }

  const nodeEnv = opts.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv === "production" && !opts.allowProduction) {
    throw new Error(
      "NODE_ENV=production ortamında --apply için ek --allow-production bayrağı zorunludur.",
    );
  }
}
