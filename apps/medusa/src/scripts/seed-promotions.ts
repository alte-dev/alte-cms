import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createPromotionsWorkflow } from "@medusajs/core-flows";

export const TEST_PROMOTIONS = [
  {
    code: "TEST10",
    type: "standard" as const,
    status: "active" as const,
    is_automatic: false,
    is_tax_inclusive: true,
    application_method: {
      type: "percentage" as const,
      target_type: "items" as const,
      allocation: "across" as const,
      value: 10,
      currency_code: "try",
    },
  },
  {
    code: "TEST50TL",
    type: "standard" as const,
    status: "active" as const,
    is_automatic: false,
    is_tax_inclusive: true,
    application_method: {
      type: "fixed" as const,
      target_type: "items" as const,
      allocation: "across" as const,
      value: 50,
      currency_code: "try",
    },
  },
];

export default async function seedPromotions({ container }: { container: MedusaContainer }) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const promotionService = container.resolve(Modules.PROMOTION);

  logger.info("Checking existing promotions for idempotent seeding...");
  const existing = await promotionService.listPromotions({});
  const existingCodes = new Set(existing.map((p: any) => p.code?.toUpperCase()));

  const toCreate = TEST_PROMOTIONS.filter((p) => !existingCodes.has(p.code.toUpperCase()));

  if (toCreate.length === 0) {
    logger.info("All test promotions (TEST10, TEST50TL) are already registered. Skipping.");
    console.log("✅ Promosyonlar zaten mevcut: TEST10, TEST50TL");
    return;
  }

  logger.info(`Creating ${toCreate.length} test promotions...`);
  await createPromotionsWorkflow(container).run({
    input: {
      promotionsData: toCreate,
    },
  });

  logger.info(`Successfully created promotions: ${toCreate.map((p) => p.code).join(", ")}`);
  console.log(`✅ Test kuponları başarıyla oluşturuldu: ${toCreate.map((p) => p.code).join(", ")}`);
}
