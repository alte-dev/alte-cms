import { Module } from "@medusajs/framework/utils";
import { CustomerAccountService } from "./service";

export * from "./service";
export * from "./helpers";
export * from "./verifiers/types";
export * from "./verifiers/registry";
export * from "./models/customer-account-state";
export * from "./models/customer-session";
export * from "./models/customer-email-verification";
export * from "./models/customer-password-reset";
export * from "./models/customer-consent";
export * from "./models/customer-legacy-credential";

export const CUSTOMER_ACCOUNT_MODULE = "customerAccountModuleService";

export default Module(CUSTOMER_ACCOUNT_MODULE, {
  service: CustomerAccountService,
});
