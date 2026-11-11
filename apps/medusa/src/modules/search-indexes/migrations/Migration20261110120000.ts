import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261110120000 extends Migration {
  override async up(): Promise<void> {
    // Enable PostgreSQL pg_trgm and unaccent extensions if user has sufficient privilege
    // (If DB user is non-superuser, extensions must be pre-created by DBA per docs/RUNBOOK.md)
    this.addSql(`
      DO $$
      BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE WARNING 'pg_trgm extension could not be created (insufficient_privilege). Ensure DBA pre-creates pg_trgm per docs/RUNBOOK.md.';
      END $$;
    `);

    this.addSql(`
      DO $$
      BEGIN
        CREATE EXTENSION IF NOT EXISTS unaccent;
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE WARNING 'unaccent extension could not be created (insufficient_privilege). Ensure DBA pre-creates unaccent per docs/RUNBOOK.md.';
      END $$;
    `);

    // Create B-tree status index and GIN trigram indexes on product table safely
    this.addSql(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'product'
        ) THEN
          CREATE INDEX IF NOT EXISTS "idx_product_status"
          ON "product" ("status");

          IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
            CREATE INDEX IF NOT EXISTS "idx_product_title_trgm"
            ON "product" USING gin ("title" gin_trgm_ops);

            CREATE INDEX IF NOT EXISTS "idx_product_subtitle_trgm"
            ON "product" USING gin ("subtitle" gin_trgm_ops);

            CREATE INDEX IF NOT EXISTS "idx_product_description_trgm"
            ON "product" USING gin ("description" gin_trgm_ops);

            CREATE INDEX IF NOT EXISTS "idx_product_handle_trgm"
            ON "product" USING gin ("handle" gin_trgm_ops);
          END IF;
        END IF;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "idx_product_title_trgm";`);
    this.addSql(`DROP INDEX IF EXISTS "idx_product_subtitle_trgm";`);
    this.addSql(`DROP INDEX IF EXISTS "idx_product_description_trgm";`);
    this.addSql(`DROP INDEX IF EXISTS "idx_product_handle_trgm";`);
    this.addSql(`DROP INDEX IF EXISTS "idx_product_status";`);
  }
}
