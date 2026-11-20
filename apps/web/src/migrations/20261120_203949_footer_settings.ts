import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "footer_tax_notice" varchar DEFAULT 'Mağazamızdaki tüm ürün fiyatlarına yasal KDV oranları (%20 standart, %10 ve %1 indirimli) dahildir.';
  ALTER TABLE "site_settings" ADD COLUMN "footer_copyright_text" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "footer_powered_by_text" varchar DEFAULT 'Alte CMS & Medusa v2 E-Ticaret Altyapısı';
  ALTER TABLE "site_settings" ADD COLUMN "footer_show_payment_badge" boolean DEFAULT true;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "footer_tax_notice";
  ALTER TABLE "site_settings" DROP COLUMN "footer_copyright_text";
  ALTER TABLE "site_settings" DROP COLUMN "footer_powered_by_text";
  ALTER TABLE "site_settings" DROP COLUMN "footer_show_payment_badge";`);
}
