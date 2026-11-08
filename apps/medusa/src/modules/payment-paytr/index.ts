import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import { PaytrPaymentService } from "./service";

export * from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  services: [PaytrPaymentService],
});
