import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261115000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "contact_message" (
        "id" text not null,
        "name" text not null,
        "email" text not null,
        "phone" text null,
        "subject" text not null,
        "message" text not null,
        "kvkk_accepted" boolean not null default false,
        "status" text not null default 'new',
        "reply_message" text null,
        "replied_at" timestamptz null,
        "replied_by" text null,
        "internal_note" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "contact_message_pkey" primary key ("id")
      );
    `);

    this.addSql(`
      create index if not exists "IDX_contact_message_status_created_at"
      on "contact_message" ("status", "created_at" desc);
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "contact_message" cascade;`);
  }
}
