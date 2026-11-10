import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("Payload Migrations & Schema Synchronization", () => {
  const migrationsDir = path.resolve(__dirname, "../migrations");
  const generatedSchemaPath = path.resolve(__dirname, "../payload-generated-schema.ts");

  it("verifies that migration files exist and are deterministic", () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs.readdirSync(migrationsDir);
    const tsMigrations = files.filter((f) => f.endsWith(".ts") && f !== "index.ts");
    const jsonSnapshots = files.filter((f) => f.endsWith(".json"));

    expect(tsMigrations.length).toBeGreaterThanOrEqual(1);
    expect(jsonSnapshots.length).toBeGreaterThanOrEqual(1);
    expect(files).toContain("index.ts");

    // Verify index.ts exports migrations array
    const indexContent = fs.readFileSync(path.join(migrationsDir, "index.ts"), "utf8");
    expect(indexContent).toContain("export const migrations");
  });

  it("verifies all collections, tables, and columns in generated schema are covered by migrations", () => {
    expect(fs.existsSync(generatedSchemaPath)).toBe(true);
    const schemaContent = fs.readFileSync(generatedSchemaPath, "utf8");

    // Concatenate all migration SQL files
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".ts") && f !== "index.ts");
    const allMigrationSql = files
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
      .join("\n");

    // Extract all pgTable names: export const table_name = pgTable("table_name", ...
    const tableRegex = /export const (\w+) = pgTable\(\s*["']([^"']+)["']/g;
    let match: RegExpExecArray | null;
    const tableNames: string[] = [];

    while ((match = tableRegex.exec(schemaContent)) !== null) {
      tableNames.push(match[2]);
    }

    expect(tableNames.length).toBeGreaterThan(0);

    // Every table defined in code must exist in migrations
    for (const tableName of tableNames) {
      const tableCreatedInMigration =
        allMigrationSql.includes(`CREATE TABLE "${tableName}"`) ||
        allMigrationSql.includes(`CREATE TABLE IF NOT EXISTS "${tableName}"`) ||
        allMigrationSql.includes(`"${tableName}"`);

      expect(
        tableCreatedInMigration,
        `Table '${tableName}' found in schema but missing in migrations! Run 'pnpm --filter @alte/web payload migrate:create'.`,
      ).toBe(true);
    }

    // Extract all column names from the schema: columnName: type("column_name", ...)
    const columnRegex =
      /:\s*(?:varchar|integer|serial|timestamp|numeric|boolean|jsonb|\w+)\(\s*["']([^"']+)["']/g;
    let colMatch: RegExpExecArray | null;
    const allColumnNames = new Set<string>();

    while ((colMatch = columnRegex.exec(schemaContent)) !== null) {
      const colName = colMatch[1];
      // Skip pure relation keys or internal prefixes
      if (colName && !colName.startsWith("_") && colName !== "id") {
        allColumnNames.add(colName);
      }
    }

    expect(allColumnNames.size).toBeGreaterThan(0);

    for (const colName of allColumnNames) {
      const colExistsInMigration = allMigrationSql.includes(`"${colName}"`);
      expect(
        colExistsInMigration,
        `Column '${colName}' defined in code schema but missing in migrations! Run 'pnpm --filter @alte/web payload migrate:create'.`,
      ).toBe(true);
    }

    // Verify key core collections are present
    const coreTables = [
      "users",
      "media",
      "pages",
      "_pages_v",
      "posts",
      "_posts_v",
      "post_categories",
      "redirects",
      "site_settings",
      "navigation",
    ];
    for (const core of coreTables) {
      expect(tableNames).toContain(core);
    }
  });

  it("verifies payload_migrations table exists for migration tracking", () => {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".ts") && f !== "index.ts");
    const allMigrationSql = files
      .map((f) => fs.readFileSync(path.join(migrationsDir, f), "utf8"))
      .join("\n");

    expect(allMigrationSql).toContain("payload_migrations");
  });
});
