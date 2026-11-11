import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/**
 * PostgreSQL Search Extensions and GIN Indexes Loader
 *
 * Ensures:
 * 1. unaccent and pg_trgm extensions exist.
 * 2. GIN trigram indexes exist on product (title, subtitle, description, handle),
 *    product_variant (sku), and product_category (name).
 * 3. Graceful handling of permission errors with clear runbook messages.
 */
export async function initializeSearchIndexes(
  container: any,
  logger: any = console,
): Promise<void> {
  let pgConnection: any = null;

  try {
    if (typeof container.resolve === "function") {
      pgConnection =
        container.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
        container.resolve("__pg_connection__");
    }
  } catch (err: any) {
    logger.warn?.(`[Search Loader] Could not resolve PG_CONNECTION: ${err.message}`);
    return;
  }

  if (!pgConnection || typeof pgConnection.raw !== "function") {
    logger.warn?.(
      "[Search Loader] PG_CONNECTION is not an active Knex instance, skipping search index setup.",
    );
    return;
  }

  // 1. Extensions Setup
  const extensions = ["unaccent", "pg_trgm"];
  for (const ext of extensions) {
    try {
      await pgConnection.raw(`CREATE EXTENSION IF NOT EXISTS ${ext};`);
      logger.info?.(`[Search Loader] Extension '${ext}' verified/created.`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes("permission denied") ||
        errMsg.includes("must be superuser") ||
        errMsg.includes("insufficient privilege")
      ) {
        logger.error?.(
          `❌ [FATAL] PostgreSQL extension '${ext}' could not be created due to insufficient permissions. ` +
            `The database user must have CREATE EXTENSION privileges or a superuser must pre-install it. Runbook: docs/RUNBOOK.md & docs/SEARCH.md`,
        );
      } else {
        logger.warn?.(`[Search Loader] Warning creating extension '${ext}': ${errMsg}`);
      }
    }
  }

  // 2. GIN Trigram & Status Indexes Setup
  const indexStatements = [
    // Product status B-tree index for published catalog filtering
    `CREATE INDEX IF NOT EXISTS "idx_product_status" ON "product" ("status");`,
    // Product title trigram GIN index
    `CREATE INDEX IF NOT EXISTS "idx_product_title_trgm" ON "product" USING gin ("title" gin_trgm_ops);`,
    // Product subtitle trigram GIN index
    `CREATE INDEX IF NOT EXISTS "idx_product_subtitle_trgm" ON "product" USING gin ("subtitle" gin_trgm_ops);`,
    // Product description trigram GIN index
    `CREATE INDEX IF NOT EXISTS "idx_product_description_trgm" ON "product" USING gin ("description" gin_trgm_ops);`,
    // Product handle trigram GIN index
    `CREATE INDEX IF NOT EXISTS "idx_product_handle_trgm" ON "product" USING gin ("handle" gin_trgm_ops);`,
    // Product variant SKU trigram GIN index
    `CREATE INDEX IF NOT EXISTS "idx_product_variant_sku_trgm" ON "product_variant" USING gin ("sku" gin_trgm_ops);`,
    // Product category name trigram GIN index
    `CREATE INDEX IF NOT EXISTS "idx_product_category_name_trgm" ON "product_category" USING gin ("name" gin_trgm_ops);`,
  ];

  for (const sql of indexStatements) {
    try {
      await pgConnection.raw(sql);
    } catch (err: any) {
      // Index creation might fail if table doesn't exist yet during initial boot, which is non-fatal
      logger.warn?.(`[Search Loader] Index statement skipped: ${err?.message?.slice(0, 100)}`);
    }
  }

  logger.info?.("[Search Loader] Search indexes initialization completed.");
}

export default async function loader({ container }: { container: any }): Promise<void> {
  const logger = container.hasRegistration?.(ContainerRegistrationKeys.LOGGER)
    ? container.resolve(ContainerRegistrationKeys.LOGGER)
    : console;

  await initializeSearchIndexes(container, logger);
}
