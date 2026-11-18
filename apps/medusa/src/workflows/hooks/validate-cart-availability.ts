import { completeCartWorkflow } from "@medusajs/core-flows";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { checkCartAvailability, formatCartAvailabilityError } from "../../utils/cart-availability";

/**
 * Validates that all non-service cart items belong to published, non-deleted products/variants
 * and have sufficient inventory before completing the cart and creating an order.
 */
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const result = await checkCartAvailability({ query }, cart.id);

  if (!result.cartFound) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Sepet bulunamadı.");
  }

  if (!result.valid) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      formatCartAvailabilityError(result.issues),
    );
  }
});
