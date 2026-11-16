import configPromise from "@payload-config";
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
} from "@payloadcms/next/routes";
import { createPayloadLoginGuardedPost } from "../../../../lib/security/payload-login-guard";

export const GET = REST_GET(configPromise);
export const POST = createPayloadLoginGuardedPost(REST_POST(configPromise), {
  maxRequests: 10,
  windowMs: 15 * 60_000,
});
export const DELETE = REST_DELETE(configPromise);
export const PATCH = REST_PATCH(configPromise);
export const OPTIONS = REST_OPTIONS(configPromise);
