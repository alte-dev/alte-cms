import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contact_messages_status" AS ENUM('new', 'in_progress', 'replied', 'archived');
  CREATE TABLE "contact_messages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"subject" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"kvkk_accepted" boolean DEFAULT false NOT NULL,
  	"status" "enum_contact_messages_status" DEFAULT 'new' NOT NULL,
  	"reply_message" varchar,
  	"replied_at" timestamp(3) with time zone,
  	"replied_by_id" integer,
  	"internal_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_contact_form_subject_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contact_messages_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_enabled" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_recipient_email" varchar;
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_auto_reply_enabled" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_auto_reply_subject" varchar DEFAULT 'Mesajınızı aldık';
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_auto_reply_intro" varchar DEFAULT 'Mesajınız bize ulaştı. Ekibimiz talebinizi inceleyip en kısa sürede sizinle iletişime geçecektir.';
  ALTER TABLE "site_settings" ADD COLUMN "contact_form_success_message" varchar DEFAULT 'Mesajınız başarıyla iletildi. En kısa sürede size dönüş yapacağız.';
  ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_replied_by_id_users_id_fk" FOREIGN KEY ("replied_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_contact_form_subject_options" ADD CONSTRAINT "site_settings_contact_form_subject_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "contact_messages_replied_by_idx" ON "contact_messages" USING btree ("replied_by_id");
  CREATE INDEX "contact_messages_updated_at_idx" ON "contact_messages" USING btree ("updated_at");
  CREATE INDEX "contact_messages_created_at_idx" ON "contact_messages" USING btree ("created_at");
  CREATE INDEX "site_settings_contact_form_subject_options_order_idx" ON "site_settings_contact_form_subject_options" USING btree ("_order");
  CREATE INDEX "site_settings_contact_form_subject_options_parent_id_idx" ON "site_settings_contact_form_subject_options" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contact_messages_fk" FOREIGN KEY ("contact_messages_id") REFERENCES "public"."contact_messages"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_contact_messages_id_idx" ON "payload_locked_documents_rels" USING btree ("contact_messages_id");`);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "contact_messages" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_contact_form_subject_options" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "contact_messages" CASCADE;
  DROP TABLE "site_settings_contact_form_subject_options" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contact_messages_fk";
  
  DROP INDEX "payload_locked_documents_rels_contact_messages_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contact_messages_id";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_recipient_email";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_auto_reply_enabled";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_auto_reply_subject";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_auto_reply_intro";
  ALTER TABLE "site_settings" DROP COLUMN "contact_form_success_message";
  DROP TYPE "public"."enum_contact_messages_status";`);
}
