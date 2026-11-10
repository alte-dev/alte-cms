import * as migration_20261109_133208_init from "./20261109_133208_init";

export const migrations = [
  {
    up: migration_20261109_133208_init.up,
    down: migration_20261109_133208_init.down,
    name: "20261109_133208_init",
  },
];
