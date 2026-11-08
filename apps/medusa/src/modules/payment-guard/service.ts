import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export interface PaymentGuardOptions {
  nodeEnv?: string;
  allowDummyInDev?: boolean;
}

/**
 * Validates configured payment providers against environment.
 * Throws FAIL-CLOSED error if dummy provider is configured in production.
 */
export function assertProductionPaymentSecurity(
  providers: string[],
  linkedRegionProviders: Array<{ regionId: string; providerId: string }> = [],
  nodeEnv: string = process.env.NODE_ENV || "development",
): void {
  const isProduction = nodeEnv === "production";

  if (!isProduction) {
    return;
  }

  // 1. Fail-closed: No payment providers configured or provider list empty
  if (!providers || providers.length === 0) {
    throw new Error(
      "FAIL-CLOSED: No payment providers configured for production environment. A certified payment provider (e.g. PayTR, Kapıda Ödeme / pp_paytr, pp_cod) must be registered.",
    );
  }

  // 2. Fail-closed: System dummy provider is enabled in payment module
  if (providers.includes("pp_system_default")) {
    throw new Error(
      "FAIL-CLOSED: 'pp_system_default' dummy payment provider is strictly prohibited in production. A certified payment provider must be configured.",
    );
  }

  // 3. Fail-closed: Any region linked to dummy payment provider
  const invalidLink = linkedRegionProviders.find((l) => l.providerId === "pp_system_default");
  if (invalidLink) {
    throw new Error(
      `FAIL-CLOSED: Region '${invalidLink.regionId}' is linked to forbidden dummy payment provider 'pp_system_default' in production.`,
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

  let paymentService: any = null;
  let linkService: any = null;
  let log: any = logger;

  try {
    if (containerOrCradle) {
      const isContainer = Object.prototype.hasOwnProperty.call(containerOrCradle, "resolve");

      if (isContainer) {
        if (containerOrCradle.hasRegistration?.(Modules.PAYMENT)) {
          paymentService = containerOrCradle.resolve(Modules.PAYMENT);
        }
        if (containerOrCradle.hasRegistration?.(Modules.LINK)) {
          linkService = containerOrCradle.resolve(Modules.LINK);
        }
        if (!log && containerOrCradle.hasRegistration?.(ContainerRegistrationKeys.LOGGER)) {
          log = containerOrCradle.resolve(ContainerRegistrationKeys.LOGGER);
        }
      } else {
        paymentService = containerOrCradle.payment;
        linkService = containerOrCradle.link_modules;
        if (!log) log = containerOrCradle.logger;
      }
    }
  } catch {
    // resolution lookup error handled below
  }

  log = log || console;

  let providerIds: string[] = [];
  const linkedRegionProviders: Array<{ regionId: string; providerId: string }> = [];

  try {
    if (paymentService && typeof paymentService.listPaymentProviders === "function") {
      const providers = await paymentService.listPaymentProviders({});
      providerIds = providers.map((p: any) => p.id);
    } else {
      if (nodeEnv === "production") {
        throw new Error("Payment module is not registered or accessible.");
      }
    }
  } catch (err: any) {
    log.error?.(`[Payment Guard] Could not query payment providers: ${err.message}`);
    if (nodeEnv === "production") {
      log.error?.(
        "❌ [FATAL] Fail-closed: Exiting process due to payment provider query error in production.",
      );
      process.exit(1);
    }
  }

  // Always log discovered providers for auditing
  console.log(`[Payment Guard] Bulunan ödeme sağlayıcıları: ${JSON.stringify(providerIds)}`);
  log.info?.(`[Payment Guard] Bulunan ödeme sağlayıcıları: ${JSON.stringify(providerIds)}`);

  try {
    if (linkService && typeof linkService.list === "function") {
      const links = await linkService.list({
        [Modules.PAYMENT]: { payment_provider_id: "pp_system_default" },
      });
      if (Array.isArray(links)) {
        for (const link of links) {
          const regId = link[Modules.REGION]?.region_id || link.region_id || "unknown";
          linkedRegionProviders.push({ regionId: regId, providerId: "pp_system_default" });
        }
      }
    }
  } catch {
    // Link service query in dev can be soft-ignored if not initialized
  }

  // If in production, enforce strict fail-closed security
  if (nodeEnv === "production") {
    try {
      assertProductionPaymentSecurity(providerIds, linkedRegionProviders, nodeEnv);
      log.info?.("✅ [Payment Guard] Production payment security check PASSED.");
    } catch (err: any) {
      log.error?.(`❌ [FATAL] Production Payment Guard violation: ${err.message}`);
      process.exit(1);
    }
  } else {
    // Development notice
    if (providerIds.includes("pp_system_default") || linkedRegionProviders.length > 0) {
      log.warn?.(
        "⚠️ [SECURITY NOTICE] Medusa is operating with dummy 'pp_system_default' payment provider. This configuration is permitted ONLY in development and will fail-closed in production.",
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
