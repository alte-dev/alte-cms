import { Module } from "@medusajs/framework/utils";
import { ContactMessageService } from "./service";

export * from "./service";
export * from "./models/contact-message";

export default Module("contactMessageModuleService", {
  service: ContactMessageService,
});
