import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "cookie_consent_enabled" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "cookie_consent_policy_version" numeric DEFAULT 1;
  ALTER TABLE "site_settings" ADD COLUMN "cookie_consent_banner_title" varchar DEFAULT 'Çerez Tercihleriniz';
  ALTER TABLE "site_settings" ADD COLUMN "cookie_consent_banner_description" varchar DEFAULT 'Sitemizin düzgün çalışması için zorunlu çerezler kullanıyoruz. İzninizle harita, analitik ve pazarlama çerezlerini de etkinleştirebilirsiniz.';
  ALTER TABLE "site_settings" ADD COLUMN "cookie_consent_policy_url" varchar DEFAULT '/sayfa/cerez-politikasi';`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "cookie_consent_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "cookie_consent_policy_version";
  ALTER TABLE "site_settings" DROP COLUMN "cookie_consent_banner_title";
  ALTER TABLE "site_settings" DROP COLUMN "cookie_consent_banner_description";
  ALTER TABLE "site_settings" DROP COLUMN "cookie_consent_policy_url";`);
}
