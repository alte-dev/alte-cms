import { Module } from "@medusajs/framework/utils";
import { EmailSettingsService } from "./service";

export * from "./service";
export * from "./models/email-setting";
export * from "./models/email-log";

export default Module("emailSettingsModuleService", {
  service: EmailSettingsService,
});
