import { MedusaService } from "@medusajs/framework/utils";
import { EmailSetting } from "./models/email-setting";
import { EmailLog } from "./models/email-log";

export class EmailSettingsService extends MedusaService({
  EmailSetting,
  EmailLog,
}) {}

export default EmailSettingsService;
