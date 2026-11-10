import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_catalog_listing_mode" AS ENUM('pagination', 'infinite');
  ALTER TABLE "site_settings" ADD COLUMN "catalog_listing_mode" "enum_site_settings_catalog_listing_mode" DEFAULT 'pagination';`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "catalog_listing_mode";
  DROP TYPE "public"."enum_site_settings_catalog_listing_mode";`);
}
