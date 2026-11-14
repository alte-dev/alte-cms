import { MedusaService } from "@medusajs/framework/utils";
import { CustomerAccountState } from "./models/customer-account-state";
import { CustomerConsent } from "./models/customer-consent";
import { CustomerEmailVerification } from "./models/customer-email-verification";
import { CustomerLegacyCredential } from "./models/customer-legacy-credential";
import { CustomerPasswordReset } from "./models/customer-password-reset";
import { CustomerSession } from "./models/customer-session";

export class CustomerAccountService extends MedusaService({
  CustomerAccountState,
  CustomerSession,
  CustomerEmailVerification,
  CustomerPasswordReset,
  CustomerConsent,
  CustomerLegacyCredential,
}) {}

export default CustomerAccountService;
