import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "payment_setting"
        add column if not exists "iyzico_enabled" boolean not null default false,
        add column if not exists "iyzico_mode" text not null default 'sandbox',
        add column if not exists "iyzico_api_key" text null,
        add column if not exists "iyzico_secret_key" text null,
        add column if not exists "iyzico_display_mode" text not null default 'redirect',
        add column if not exists "iyzico_max_installment" integer not null default 1,
        add column if not exists "iyzico_lang" text not null default 'tr',
        add column if not exists "default_payment_method" text null;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "payment_setting"
        drop column if exists "iyzico_enabled",
        drop column if exists "iyzico_mode",
        drop column if exists "iyzico_api_key",
        drop column if exists "iyzico_secret_key",
        drop column if exists "iyzico_display_mode",
        drop column if exists "iyzico_max_installment",
        drop column if exists "iyzico_lang",
        drop column if exists "default_payment_method";
    `);
  }
}
