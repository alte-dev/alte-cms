import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import { CodPaymentService } from "./service";

export * from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  services: [CodPaymentService],
});
