import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { executePaymentSecurityCheck } from "../modules/payment-guard/service";

export * from "../modules/payment-guard/service";

export default async function loader({ container }: { container: any }): Promise<void> {
  const logger = container.hasRegistration?.(ContainerRegistrationKeys.LOGGER)
    ? container.resolve(ContainerRegistrationKeys.LOGGER)
    : console;
  await executePaymentSecurityCheck(container, logger);
}
