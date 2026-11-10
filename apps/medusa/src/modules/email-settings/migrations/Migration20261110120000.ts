import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261110120000 extends Migration {
  override async up(): Promise<void> {
    // Enable PostgreSQL pg_trgm and unaccent extensions for high-performance Turkish search
    this.addSql(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    this.addSql(`CREATE EXTENSION IF NOT EXISTS unaccent;`);

    // GIN trigram indexes on product title and subtitle for fast ILIKE and similarity queries
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_product_title_trgm" 
      ON "product" USING gin ("title" gin_trgm_ops);
    `);

    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_product_subtitle_trgm" 
      ON "product" USING gin ("subtitle" gin_trgm_ops);
    `);

    // B-tree index on product status for filtering published items
    this.addSql(`
      CREATE INDEX IF NOT EXISTS "idx_product_status" 
      ON "product" ("status");
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "idx_product_title_trgm";`);
    this.addSql(`DROP INDEX IF EXISTS "idx_product_subtitle_trgm";`);
    this.addSql(`DROP INDEX IF EXISTS "idx_product_status";`);
  }
}
