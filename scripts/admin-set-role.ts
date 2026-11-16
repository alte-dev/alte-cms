/**
 * scripts/admin-set-role.ts
 *
 * Explicitly assigns a role (`super-admin`, `admin`, `shop-manager`, `editor`, `author`)
 * to an existing Medusa admin user in `user.metadata.role`.
 *
 * Usage:
 *   pnpm admin:set-role -- <email> <role>
 */

import fs from "fs";
import path from "path";
import pg from "pg";

const ALLOWED_ROLES = new Set(["super-admin", "admin", "shop-manager", "editor", "author"]);

function loadEnvIfPresent(relPath: string): void {
  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return;
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) {
      process.env[key] = rawVal;
    }
  }
}

export async function setAdminUserRole(
  pool: pg.Pool,
  email: string,
  role: string,
): Promise<{ updated: boolean; userId?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("Geçerli bir e-posta adresi giriniz.");
  }
  if (!ALLOWED_ROLES.has(role)) {
    throw new Error(
      `Geçersiz rol: '${role}'. İzin verilen roller: ${Array.from(ALLOWED_ROLES).join(", ")}`,
    );
  }

  const res = await pool.query(
    `SELECT id, metadata FROM "user" WHERE LOWER(email) = $1 AND deleted_at IS NULL LIMIT 1`,
    [normalizedEmail],
  );
  if (res.rowCount === 0) {
    return { updated: false };
  }

  const row = res.rows[0] as { id: string; metadata: Record<string, unknown> | null };
  const nextMeta = { ...(row.metadata || {}), role };
  await pool.query(`UPDATE "user" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`, [
    JSON.stringify(nextMeta),
    row.id,
  ]);
  return { updated: true, userId: row.id };
}

async function main() {
  loadEnvIfPresent("apps/medusa/.env");
  loadEnvIfPresent(".env");

  const args = process.argv.slice(2).filter((a) => a !== "--");
  const email = args[0] || process.env.ADMIN_ROLE_EMAIL || "";
  const role = args[1] || process.env.ADMIN_ROLE_VALUE || "";

  if (!email || !role) {
    console.error("Kullanım: pnpm admin:set-role -- <e-posta> <rol>");
    console.error(`Roller: ${Array.from(ALLOWED_ROLES).join(" | ")}`);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL ortam değişkeni tanımlı olmalıdır.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });
  try {
    const result = await setAdminUserRole(pool, email, role);
    if (!result.updated) {
      console.error(`Kullanıcı bulunamadı: ${email}`);
      process.exit(1);
    }
    console.log(`✅ Rol güncellendi: user_id=${result.userId}, role=${role}`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith("admin-set-role.ts")) {
  main().catch((err) => {
    console.error("❌ Hata:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
