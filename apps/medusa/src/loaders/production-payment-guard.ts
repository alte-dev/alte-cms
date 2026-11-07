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

  // 1. Fail-closed: No payment providers configured
  if (providers.length === 0) {
    throw new Error(
      "FAIL-CLOSED: No payment providers configured for production environment. A certified payment provider (e.g. PayTR, Iyzico, Stripe) must be registered.",
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
 * Medusa startup loader for payment security guard.
 * Runs on Medusa startup (and onApplicationStart) to inspect payment configuration.
 */
export async function productionPaymentGuardLoader(
  container: any,
  logger?: any,
  overrideEnv?: string,
): Promise<void> {
  const nodeEnv = overrideEnv || process.env.NODE_ENV || "development";
  const log = logger || console;

  let providerIds: string[] = [];
  const linkedRegionProviders: Array<{ regionId: string; providerId: string }> = [];

  try {
    if (container.hasRegistration && container.hasRegistration(Modules.PAYMENT)) {
      const paymentService = container.resolve(Modules.PAYMENT);
      if (paymentService && typeof paymentService.listPaymentProviders === "function") {
        const providers = await paymentService.listPaymentProviders({});
        providerIds = providers.map((p: any) => p.id);
      }
    }
  } catch (err: any) {
    log.warn?.(`[Payment Guard] Could not query payment providers: ${err.message}`);
  }

  try {
    if (container.hasRegistration && container.hasRegistration(Modules.LINK)) {
      const linkService = container.resolve(Modules.LINK);
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
    }
  } catch {
    // Link service may not have links yet
  }

  // If in production, enforce strict fail-closed security
  if (nodeEnv === "production") {
    assertProductionPaymentSecurity(providerIds, linkedRegionProviders, nodeEnv);
    log.info?.("✅ [Payment Guard] Production payment security check PASSED.");
  } else {
    // Development notice
    if (providerIds.includes("pp_system_default") || linkedRegionProviders.length > 0) {
      log.warn?.(
        "⚠️ [SECURITY NOTICE] Medusa is operating with dummy 'pp_system_default' payment provider. This configuration is permitted ONLY in development and will fail-closed in production.",
      );
    }
  }
}

export default async function loader({ container }: { container: any }): Promise<void> {
  const logger = container.hasRegistration(ContainerRegistrationKeys.LOGGER)
    ? container.resolve(ContainerRegistrationKeys.LOGGER)
    : console;
  await productionPaymentGuardLoader(container, logger);
}
