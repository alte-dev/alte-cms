import { MedusaService } from "@medusajs/framework/utils";
import { ContactMessage } from "./models/contact-message";

export class ContactMessageService extends MedusaService({
  ContactMessage,
}) {}
