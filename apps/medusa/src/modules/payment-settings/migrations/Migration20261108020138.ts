import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261108020138 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table if not exists "payment_setting" ("id" text not null, "paytr_enabled" boolean not null default false, "paytr_mode" text not null default 'sandbox', "paytr_merchant_id" text null, "paytr_merchant_key" text null, "paytr_merchant_salt" text null, "paytr_display_mode" text not null default 'iframe', "paytr_no_installment" boolean not null default false, "paytr_max_installment" integer not null default 0, "paytr_timeout_limit" integer not null default 30, "paytr_lang" text not null default 'tr', "cod_enabled" boolean not null default false, "cod_fee" integer not null default 100, "cod_fee_label" text not null default 'Kapıda Ödeme Hizmet Bedeli', "cod_max_order_amount" integer null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_setting_pkey" primary key ("id"));`,
    );
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_payment_setting_deleted_at" ON "payment_setting" ("deleted_at") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "payment_setting" cascade;`);
  }
}
