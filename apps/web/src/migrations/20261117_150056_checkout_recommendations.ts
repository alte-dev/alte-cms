import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_checkout_recommended_source" AS ENUM('bestsellers', 'manual');
  ALTER TABLE "site_settings" ADD COLUMN "checkout_show_recommended_products" boolean DEFAULT false;
  ALTER TABLE "site_settings" ADD COLUMN "checkout_recommended_title" varchar DEFAULT 'Bunları da ekleyebilirsiniz';
  ALTER TABLE "site_settings" ADD COLUMN "checkout_recommended_source" "enum_site_settings_checkout_recommended_source" DEFAULT 'bestsellers';
  ALTER TABLE "site_settings" ADD COLUMN "checkout_recommended_handles" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "checkout_recommended_limit" numeric DEFAULT 3;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "checkout_show_recommended_products";
  ALTER TABLE "site_settings" DROP COLUMN "checkout_recommended_title";
  ALTER TABLE "site_settings" DROP COLUMN "checkout_recommended_source";
  ALTER TABLE "site_settings" DROP COLUMN "checkout_recommended_handles";
  ALTER TABLE "site_settings" DROP COLUMN "checkout_recommended_limit";
  DROP TYPE "public"."enum_site_settings_checkout_recommended_source";`);
}
