import { Module } from "@medusajs/framework/utils";
import { SearchIndexesModuleService } from "./service";

export * from "./service";

export default Module("searchIndexesModuleService", {
  service: SearchIndexesModuleService,
});
