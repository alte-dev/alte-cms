import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import { initializeSearchIndexes } from "./search-indexes";

describe("Search Indexes Module & Loader Isolation", () => {
  it("removes product index migration from email-settings module and places it in dedicated search-indexes module", () => {
    const wrongMigrationPath = path.resolve(
      __dirname,
      "../modules/email-settings/migrations/Migration20261110120000.ts",
    );
    const dedicatedMigrationPath = path.resolve(
      __dirname,
      "../modules/search-indexes/migrations/Migration20261110120000.ts",
    );

    expect(fs.existsSync(wrongMigrationPath)).toBe(false);
    expect(fs.existsSync(dedicatedMigrationPath)).toBe(true);

    const migrationSource = fs.readFileSync(dedicatedMigrationPath, "utf8");
    expect(migrationSource).toContain("idx_product_title_trgm");
    expect(migrationSource).toContain("idx_product_subtitle_trgm");
    expect(migrationSource).toContain("idx_product_status");
  });

  it("creates idx_product_title_trgm, idx_product_subtitle_trgm, and idx_product_status in initializeSearchIndexes", async () => {
    const executedSql: string[] = [];
    const mockPgConnection = {
      raw: vi.fn(async (sql: string) => {
        executedSql.push(sql);
      }),
    };
    const mockContainer = {
      resolve: vi.fn(() => mockPgConnection),
    };
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    await initializeSearchIndexes(mockContainer, mockLogger);

    expect(executedSql.some((s) => s.includes("idx_product_title_trgm"))).toBe(true);
    expect(executedSql.some((s) => s.includes("idx_product_subtitle_trgm"))).toBe(true);
    expect(executedSql.some((s) => s.includes("idx_product_status"))).toBe(true);
  });

  it("logs a clear runbook error when database user lacks CREATE EXTENSION privileges", async () => {
    const mockPgConnection = {
      raw: vi.fn(async (sql: string) => {
        if (sql.includes("CREATE EXTENSION")) {
          throw new Error('permission denied to create extension "pg_trgm"');
        }
      }),
    };
    const mockContainer = {
      resolve: vi.fn(() => mockPgConnection),
    };
    const mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    await initializeSearchIndexes(mockContainer, mockLogger);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining("Runbook:"));
  });
});
