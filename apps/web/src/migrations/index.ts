import * as migration_20261109_133208_init from "./20261109_133208_init";
import * as migration_20261110_143652_add_catalog_listing_mode from "./20261110_143652_add_catalog_listing_mode";
import * as migration_20261114_232001_add_contact_form_and_messages from "./20261114_232001_add_contact_form_and_messages";
import * as migration_20261115_000116_add_contact_page_content_and_map from "./20261115_000116_add_contact_page_content_and_map";
import * as migration_20261117_150056_checkout_recommendations from "./20261117_150056_checkout_recommendations";

export const migrations = [
  {
    up: migration_20261109_133208_init.up,
    down: migration_20261109_133208_init.down,
    name: "20261109_133208_init",
  },
  {
    up: migration_20261110_143652_add_catalog_listing_mode.up,
    down: migration_20261110_143652_add_catalog_listing_mode.down,
    name: "20261110_143652_add_catalog_listing_mode",
  },
  {
    up: migration_20261114_232001_add_contact_form_and_messages.up,
    down: migration_20261114_232001_add_contact_form_and_messages.down,
    name: "20261114_232001_add_contact_form_and_messages",
  },
  {
    up: migration_20261115_000116_add_contact_page_content_and_map.up,
    down: migration_20261115_000116_add_contact_page_content_and_map.down,
    name: "20261115_000116_add_contact_page_content_and_map",
  },
  {
    up: migration_20261117_150056_checkout_recommendations.up,
    down: migration_20261117_150056_checkout_recommendations.down,
    name: "20261117_150056_checkout_recommendations",
  },
];
