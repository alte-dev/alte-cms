import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export interface PaymentGuardOptions {
  nodeEnv?: string;
  allowDummyInDev?: boolean;
}

export const CERTIFIED_PAYMENT_PROVIDERS = ["pp_paytr_paytr", "pp_cod_cod"];

/**
 * Asserts that prohibited development-only environment variables are NOT defined in production.
 */
export function assertUndefinedInProduction(
  nodeEnv: string = process.env.NODE_ENV || "development",
): void {
  if (nodeEnv !== "production") {
    return;
  }

  if (process.env.PAYTR_API_BASE && process.env.PAYTR_API_BASE.trim() !== "") {
    throw new Error(
      "FAIL-CLOSED: PAYTR_API_BASE environment variable is strictly prohibited in production.",
    );
  }

  if (process.env.DEV_PAYTR_USER_IP && process.env.DEV_PAYTR_USER_IP.trim() !== "") {
    throw new Error(
      "FAIL-CLOSED: DEV_PAYTR_USER_IP environment variable is strictly prohibited in production.",
    );
  }
}

/**
 * Reads region-payment provider linkages directly from 'region_payment_provider' table.
 * Fail-closed if database connection or query is unavailable.
 */
export async function getLinkedRegionProviders(
  containerOrCradle: any,
): Promise<Array<{ regionId: string; providerId: string }>> {
  let pgConnection: any = null;

  if (containerOrCradle) {
    // 1. Try container.resolve (wrapped in try/catch in case containerOrCradle is an Awilix cradle proxy)
    try {
      if (typeof containerOrCradle.resolve === "function") {
        try {
          pgConnection =
            containerOrCradle.resolve(ContainerRegistrationKeys.PG_CONNECTION) ||
            containerOrCradle.resolve("__pg_connection__");
        } catch {
          // resolution key fallback
        }
      }
    } catch {
      // Accessing .resolve on an Awilix cradle proxy throws 'Could not resolve resolve'
    }

    // 2. Try direct property access on cradle or mock
    if (!pgConnection) {
      try {
        pgConnection =
          containerOrCradle.__pg_connection__ ||
          containerOrCradle[ContainerRegistrationKeys.PG_CONNECTION] ||
          containerOrCradle.pgConnection;
      } catch {
        // ignore
      }
    }
  }

  if (pgConnection) {
    const rows = await pgConnection("region_payment_provider")
      .select("region_id", "payment_provider_id")
      .whereNull("deleted_at");

    return rows.map((r: any) => ({
      regionId: r.region_id,
      providerId: r.payment_provider_id,
    }));
  }

  throw new Error("Could not resolve database connection to query 'region_payment_provider'.");
}

/**
 * Validates configured payment providers bound to regions in production.
 * Throws FAIL-CLOSED error if dummy provider is configured or no certified provider is linked.
 */
export function assertProductionPaymentSecurity(
  linkedRegionProviders: Array<{ regionId: string; providerId: string }>,
  nodeEnv: string = process.env.NODE_ENV || "development",
): void {
  const isProduction = nodeEnv === "production";
  if (!isProduction) {
    return;
  }

  // 1. Verify environment variables are clean in production
  assertUndefinedInProduction(nodeEnv);

  // 2. Fail-closed: No providers linked to any region
  if (!linkedRegionProviders || linkedRegionProviders.length === 0) {
    throw new Error(
      "FAIL-CLOSED: No payment providers are linked to any region in production (region_payment_provider is empty).",
    );
  }

  // 3. Rule (a): Any region linked to pp_system_default -> fail-closed
  const dummyLink = linkedRegionProviders.find((l) => l.providerId === "pp_system_default");
  if (dummyLink) {
    throw new Error(
      `FAIL-CLOSED: Region '${dummyLink.regionId}' is linked to forbidden dummy payment provider 'pp_system_default' in production.`,
    );
  }

  // 4. Rule (b): No certified real provider linked to any region -> fail-closed
  const hasRealProvider = linkedRegionProviders.some((l) =>
    CERTIFIED_PAYMENT_PROVIDERS.includes(l.providerId),
  );
  if (!hasRealProvider) {
    throw new Error(
      "FAIL-CLOSED: No certified real payment provider ('pp_paytr_paytr' or 'pp_cod_cod') is linked to any region in production.",
    );
  }

  // 5. Rule (c): Ensure only certified providers are linked
  const invalidLinks = linkedRegionProviders.filter(
    (l) => !CERTIFIED_PAYMENT_PROVIDERS.includes(l.providerId),
  );
  if (invalidLinks.length > 0) {
    throw new Error(
      `FAIL-CLOSED: Unauthorized payment provider(s) linked in production: ${invalidLinks.map((l) => l.providerId).join(", ")}.`,
    );
  }
}

/**
 * Executes payment security audit against container or Awilix cradle.
 * Must be executed on application start after all modules are initialized.
 */
export async function executePaymentSecurityCheck(
  containerOrCradle: any,
  logger?: any,
  overrideEnv?: string,
): Promise<void> {
  const nodeEnv = overrideEnv || process.env.NODE_ENV || "development";
  let log: any = logger;

  try {
    if (containerOrCradle && "cradle" in containerOrCradle && !log) {
      if (containerOrCradle.hasRegistration?.(ContainerRegistrationKeys.LOGGER)) {
        log = containerOrCradle.resolve(ContainerRegistrationKeys.LOGGER);
      }
    }
  } catch {
    // resolution error handled below
  }

  log = log || console;

  let linkedRegionProviders: Array<{ regionId: string; providerId: string }> = [];

  try {
    linkedRegionProviders = await getLinkedRegionProviders(containerOrCradle);
    log.info?.(
      `[Payment Guard] Bulunan bölge-sağlayıcı bağlantıları: ${JSON.stringify(linkedRegionProviders)}`,
    );
    console.log(
      `[Payment Guard] Bulunan bölge-sağlayıcı bağlantıları: ${JSON.stringify(linkedRegionProviders)}`,
    );
  } catch (err: any) {
    log.error?.(`[Payment Guard] Could not query region payment providers: ${err.message}`);
    console.error(`[Payment Guard] Could not query region payment providers: ${err.message}`);
    if (nodeEnv === "production") {
      log.error?.(
        "❌ [FATAL] Fail-closed: Exiting process due to failure reading region_payment_provider in production.",
      );
      console.error(
        "❌ [FATAL] Fail-closed: Exiting process due to failure reading region_payment_provider in production.",
      );
      process.exit(1);
    }
  }

  // If in production, enforce strict fail-closed security
  if (nodeEnv === "production") {
    try {
      assertProductionPaymentSecurity(linkedRegionProviders, nodeEnv);
      log.info?.("✅ [Payment Guard] Production payment security check PASSED (guard PASSED).");
      console.log("✅ [Payment Guard] Production payment security check PASSED (guard PASSED).");
    } catch (err: any) {
      log.error?.(`❌ [FATAL] Production Payment Guard violation: ${err.message}`);
      console.error(`❌ [FATAL] Production Payment Guard violation: ${err.message}`);
      process.exit(1);
    }
  } else {
    // Development notice
    const hasDummy = linkedRegionProviders.some((l) => l.providerId === "pp_system_default");
    if (hasDummy) {
      log.warn?.(
        "⚠️ [SECURITY NOTICE] Medusa is operating with dummy 'pp_system_default' payment provider linked to region. Permitted in dev, strictly prohibited in production.",
      );
    }
  }
}

export class PaymentGuardModuleService {
  __hooks: { onApplicationStart?: () => Promise<void> };

  constructor(cradle: any) {
    this.__hooks = {
      onApplicationStart: async () => {
        try {
          await executePaymentSecurityCheck(cradle);
        } catch (err: any) {
          console.error("❌ [Payment Guard] ERROR IN onApplicationStart:", err);
          if (process.env.NODE_ENV === "production") {
            process.exit(1);
          }
        }
      },
    };
  }
}
