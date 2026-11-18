import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261117010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "orphan_payment" (
        "id" text not null,
        "token_hash" text not null,
        "provider" text not null default 'iyzico',
        "iyzico_payment_id" text null,
        "cart_id" text null,
        "amount" numeric not null default 0,
        "currency" text not null default 'TRY',
        "status" text not null default 'needs_manual_refund',
        "reason" text not null default 'SESSION_NOT_FOUND_OR_CART_MUTATED',
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        constraint "orphan_payment_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orphan_payment_token_hash" ON "orphan_payment" ("token_hash");`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "orphan_payment" cascade;`);
  }
}
