import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "contact_form_page_title" varchar DEFAULT 'Bizimle İletişime Geçin';
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_page_subtitle" varchar DEFAULT 'Sorularınız, siparişleriniz veya özel talepleriniz için bize her zaman ulaşabilirsiniz.';
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_top_content" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_bottom_content" varchar DEFAULT 'Müşteri temsilcilerimiz ilettiğiniz tüm taleplere iş günleri içinde en geç 24 saat içerisinde dönüş yapmaktadır.';
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_working_hours" varchar DEFAULT 'Hafta içi: 09:00 - 18:00';
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_show_map" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_map_query" varchar;`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "contact_form_page_title";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_page_subtitle";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_top_content";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_bottom_content";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_working_hours";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_show_map";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_map_query";`);
}
