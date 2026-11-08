import { Module } from "@medusajs/framework/utils";
import { PaymentSettingsService } from "./service";

export * from "./service";
export * from "./models/payment-setting";

export default Module("paymentSettingsModuleService", {
  service: PaymentSettingsService,
});
