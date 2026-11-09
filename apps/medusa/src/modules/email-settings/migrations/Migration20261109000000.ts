import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261109000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "email_setting" (
        "id" text not null,
        "enabled" boolean not null default false,
        "host" text null,
        "port" integer not null default 587,
        "secure" boolean not null default false,
        "username" text null,
        "password" text null,
        "from_name" text not null default 'Mağaza',
        "from_email" text not null default 'siparis@example.test',
        "reply_to" text null,
        "admin_notify_email" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "email_setting_pkey" primary key ("id")
      );
    `);

    this.addSql(`
      create table if not exists "email_log" (
        "id" text not null,
        "order_id" text not null,
        "template" text not null,
        "idempotency_key" text not null,
        "recipient_masked" text not null,
        "subject" text not null,
        "status" text not null,
        "error_code" text null,
        "attempts" integer not null default 1,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "email_log_pkey" primary key ("id"),
        constraint "email_log_idempotency_key_unique" unique ("idempotency_key")
      );
    `);

    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_email_log_order_id" ON "email_log" ("order_id");`);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_email_log_created_at" ON "email_log" ("created_at" desc);`,
    );

    // PII Cleanup Migration: Drop payload_json column if it exists from older schema
    this.addSql(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'email_log' AND column_name = 'payload_json'
        ) THEN
          UPDATE email_log SET payload_json = NULL;
          ALTER TABLE email_log DROP COLUMN payload_json;
        END IF;
      END $$;
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "email_log" cascade;`);
    this.addSql(`drop table if exists "email_setting" cascade;`);
  }
}
