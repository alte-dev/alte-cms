import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { hashToken } from "../../../../modules/customer-account/helpers";
import { extractBearerToken } from "../../../middleware-guards";
import { getPgConnection } from "../_shared";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const token = extractBearerToken(req as any);
  if (token) {
    const pgConnection = getPgConnection(req);
    const now = new Date();
    await pgConnection("customer_session")
      .where({ token_hash: hashToken(token) })
      .whereNull("revoked_at")
      .update({ revoked_at: now, updated_at: now });
  }
  return res.status(200).json({ ok: true });
};
