import { Module } from "@medusajs/framework/utils";
import productionPaymentGuardLoader from "../../loaders/production-payment-guard";

export class PaymentGuardModuleService {
  async onApplicationStart() {
    // Ensured via loader
  }
}

export default Module("paymentGuardModuleService", {
  service: PaymentGuardModuleService,
  loaders: [productionPaymentGuardLoader],
});
