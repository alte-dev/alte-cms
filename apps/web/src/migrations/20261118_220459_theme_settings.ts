import { MigrateUpArgs, MigrateDownArgs, sql } from "@payloadcms/db-postgres";

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_theme_settings_typography_font_family" AS ENUM('inter', 'system', 'serif', 'mono');
  CREATE TYPE "public"."enum_theme_settings_typography_heading_font_family" AS ENUM('inherit', 'inter', 'serif', 'system');
  CREATE TYPE "public"."enum_theme_settings_typography_base_font_size" AS ENUM('14px', '15px', '16px', '17px');
  CREATE TYPE "public"."enum_theme_settings_typography_heading_weight" AS ENUM('600', '700', '800');
  CREATE TYPE "public"."enum_theme_settings_typography_heading_letter_spacing" AS ENUM('tight', 'normal', 'wide');
  CREATE TYPE "public"."enum_theme_settings_typography_line_height" AS ENUM('compact', 'normal', 'relaxed');
  CREATE TYPE "public"."enum_theme_settings_buttons_button_radius" AS ENUM('none', 'sm', 'md', 'lg', 'full');
  CREATE TYPE "public"."enum_theme_settings_buttons_border_radius" AS ENUM('none', 'sm', 'md', 'lg', 'full');
  CREATE TYPE "public"."enum_theme_settings_buttons_button_text_transform" AS ENUM('none', 'uppercase');
  CREATE TYPE "public"."enum_theme_settings_buttons_button_font_weight" AS ENUM('500', '600', '700');
  CREATE TABLE "theme_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"colors_primary_color" varchar DEFAULT '#3A4A5B',
  	"colors_primary_hover_color" varchar DEFAULT '#2E3B49',
  	"colors_primary_text_color" varchar DEFAULT '#FFFFFF',
  	"colors_accent_color" varchar DEFAULT '#92A3B6',
  	"colors_background_color" varchar DEFAULT '#FAFAF9',
  	"colors_surface_color" varchar DEFAULT '#FFFFFF',
  	"colors_surface_subdued_color" varchar DEFAULT '#F5F5F5',
  	"colors_border_color" varchar DEFAULT '#DEDEDE',
  	"colors_text_color" varchar DEFAULT '#1C1917',
  	"colors_text_muted_color" varchar DEFAULT '#666666',
  	"colors_announcement_bg_color" varchar DEFAULT '#3A4A5B',
  	"colors_announcement_text_color" varchar DEFAULT '#FFFFFF',
  	"colors_header_bg_color" varchar DEFAULT '#FFFFFF',
  	"colors_footer_bg_color" varchar DEFAULT '#1C1917',
  	"colors_footer_text_color" varchar DEFAULT '#E7E5E4',
  	"typography_font_family" "enum_theme_settings_typography_font_family" DEFAULT 'inter',
  	"typography_heading_font_family" "enum_theme_settings_typography_heading_font_family" DEFAULT 'inherit',
  	"typography_base_font_size" "enum_theme_settings_typography_base_font_size" DEFAULT '16px',
  	"typography_heading_weight" "enum_theme_settings_typography_heading_weight" DEFAULT '700',
  	"typography_heading_letter_spacing" "enum_theme_settings_typography_heading_letter_spacing" DEFAULT 'tight',
  	"typography_line_height" "enum_theme_settings_typography_line_height" DEFAULT 'normal',
  	"buttons_button_radius" "enum_theme_settings_buttons_button_radius" DEFAULT 'md',
  	"buttons_border_radius" "enum_theme_settings_buttons_border_radius" DEFAULT 'md',
  	"buttons_button_text_transform" "enum_theme_settings_buttons_button_text_transform" DEFAULT 'none',
  	"buttons_button_font_weight" "enum_theme_settings_buttons_button_font_weight" DEFAULT '600',
  	"checkout_theme_checkout_left_bg_color" varchar DEFAULT '#FFFFFF',
  	"checkout_theme_checkout_summary_bg_color" varchar DEFAULT '#F5F5F5',
  	"checkout_theme_checkout_badge_bg_color" varchar DEFAULT '#666666',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  `);
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "theme_settings" CASCADE;
  DROP TYPE "public"."enum_theme_settings_typography_font_family";
  DROP TYPE "public"."enum_theme_settings_typography_heading_font_family";
  DROP TYPE "public"."enum_theme_settings_typography_base_font_size";
  DROP TYPE "public"."enum_theme_settings_typography_heading_weight";
  DROP TYPE "public"."enum_theme_settings_typography_heading_letter_spacing";
  DROP TYPE "public"."enum_theme_settings_typography_line_height";
  DROP TYPE "public"."enum_theme_settings_buttons_button_radius";
  DROP TYPE "public"."enum_theme_settings_buttons_border_radius";
  DROP TYPE "public"."enum_theme_settings_buttons_button_text_transform";
  DROP TYPE "public"."enum_theme_settings_buttons_button_font_weight";`);
}
