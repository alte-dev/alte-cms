import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261114000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      create table if not exists "customer_account_state" (
        "id" text not null,
        "customer_id" text not null,
        "email_verified_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "customer_account_state_pkey" primary key ("id"),
        constraint "customer_account_state_customer_id_unique" unique ("customer_id")
      );
    `);

    this.addSql(`
      create table if not exists "customer_session" (
        "id" text not null,
        "customer_id" text not null,
        "token_hash" text not null,
        "last_seen_at" timestamptz not null,
        "expires_at" timestamptz not null,
        "revoked_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "customer_session_pkey" primary key ("id"),
        constraint "customer_session_token_hash_unique" unique ("token_hash")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_customer_session_customer_id" ON "customer_session" ("customer_id");`,
    );

    this.addSql(`
      create table if not exists "customer_email_verification" (
        "id" text not null,
        "customer_id" text not null,
        "token_hash" text not null,
        "expires_at" timestamptz not null,
        "used_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "customer_email_verification_pkey" primary key ("id"),
        constraint "customer_email_verification_token_hash_unique" unique ("token_hash")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_customer_email_verification_customer_id" ON "customer_email_verification" ("customer_id");`,
    );

    this.addSql(`
      create table if not exists "customer_password_reset" (
        "id" text not null,
        "customer_id" text not null,
        "token_hash" text not null,
        "expires_at" timestamptz not null,
        "used_at" timestamptz null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "customer_password_reset_pkey" primary key ("id"),
        constraint "customer_password_reset_token_hash_unique" unique ("token_hash")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_customer_password_reset_customer_id" ON "customer_password_reset" ("customer_id");`,
    );

    this.addSql(`
      create table if not exists "customer_consent" (
        "id" text not null,
        "customer_id" text not null,
        "consent_type" text not null,
        "granted" boolean not null,
        "document_version" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "customer_consent_pkey" primary key ("id")
      );
    `);
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_customer_consent_customer_id" ON "customer_consent" ("customer_id");`,
    );

    this.addSql(`
      create table if not exists "customer_legacy_credential" (
        "id" text not null,
        "customer_id" text not null,
        "email_lookup" text not null,
        "algorithm" text not null,
        "hash_encrypted" text not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "customer_legacy_credential_pkey" primary key ("id"),
        constraint "customer_legacy_credential_customer_id_unique" unique ("customer_id"),
        constraint "customer_legacy_credential_email_lookup_unique" unique ("email_lookup")
      );
    `);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "customer_legacy_credential" cascade;`);
    this.addSql(`drop table if exists "customer_consent" cascade;`);
    this.addSql(`drop table if exists "customer_password_reset" cascade;`);
    this.addSql(`drop table if exists "customer_email_verification" cascade;`);
    this.addSql(`drop table if exists "customer_session" cascade;`);
    this.addSql(`drop table if exists "customer_account_state" cascade;`);
  }
}
