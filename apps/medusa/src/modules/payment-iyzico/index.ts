import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import { IyzicoPaymentService } from "./service";

export * from "./service";

export default ModuleProvider(Modules.PAYMENT, {
  services: [IyzicoPaymentService],
});
