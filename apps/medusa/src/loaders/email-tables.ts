import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { ensureEmailTables } from "../services/email-service";

export default async function emailTablesLoader({
  container,
}: {
  container: MedusaContainer;
}): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  let pgConnection: any = null;

  try {
    pgConnection =
      container.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
      container.resolve("__pg_connection__");
  } catch {
    // pg_connection not available yet
  }

  if (!pgConnection) {
    logger?.warn?.("[Email Loader] PG_CONNECTION çözülemedi, tablolar ilk istekte oluşturulacak.");
    return;
  }

  try {
    await ensureEmailTables(pgConnection);
    logger?.info?.("✓ Email notification tables initialized (email_setting, email_log).");
  } catch (err: any) {
    logger?.warn?.(`[Email Loader] Tablolar başlatılırken uyarı: ${err.message}`);
  }
}
