import { Module } from "@medusajs/framework/utils";
import { PaymentGuardModuleService } from "./service";

export * from "./service";

export default Module("paymentGuardModuleService", {
  service: PaymentGuardModuleService,
});
