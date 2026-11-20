import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261120000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      alter table "payment_setting"
        add column if not exists "iyzico_footer_logo_variant" text not null default 'colored';
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`
      alter table "payment_setting"
        drop column if exists "iyzico_footer_logo_variant";
    `);
  }
}
