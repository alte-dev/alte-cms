import { defineMiddlewares } from "@medusajs/framework/http";
import {
  blockCustomerTokenRefresh,
  blockRoute,
  customerSessionGuard,
  defaultAdminProductOrder,
  normalizeDefaultProductOption,
  orderOwnershipGuard,
  requireInternalSecret,
  strictCustomerSessionGuard,
} from "./middleware-guards";

export default defineMiddlewares({
  routes: [
    // Close direct customer auth endpoints (enforce password policy, rate limit, consent, legacy verifiers via /store/account/*)
    {
      matcher: "/auth/customer",
      middlewares: [requireInternalSecret],
    },
    {
      matcher: "/auth/token/refresh",
      middlewares: [blockCustomerTokenRefresh],
    },
    // Protect all custom account endpoints with internal secret + session check where applicable
    {
      matcher: "/store/account",
      middlewares: [requireInternalSecret, customerSessionGuard],
    },
    // Protect internal service endpoints (e.g. contact form emails) with internal secret
    {
      matcher: "/store/internal",
      middlewares: [requireInternalSecret],
    },
    {
      matcher: "/internal",
      middlewares: [requireInternalSecret],
    },
    // Prevent bypassing registration via direct POST /store/customers
    {
      method: ["POST"],
      matcher: "/store/customers",
      middlewares: [requireInternalSecret],
    },
    // Enforce strict customer session (401 if no Bearer token) + revocation on built-in customer & order routes
    {
      matcher: "/store/customers/me",
      middlewares: [strictCustomerSessionGuard],
    },
    {
      matcher: "/store/orders",
      middlewares: [strictCustomerSessionGuard],
    },
    {
      matcher: "/auth/session",
      middlewares: [strictCustomerSessionGuard],
    },
    // Disable unauthenticated direct order lookup by UUID unless internal secret or owning customer
    {
      method: ["GET"],
      matcher: "/store/orders/:id",
      middlewares: [orderOwnershipGuard],
    },
    // Disable Medusa built-in order transfer endpoints (linking happens strictly after email verification)
    {
      matcher: "/store/orders/:id/transfer",
      middlewares: [blockRoute],
    },
    // Default Medusa Admin products list to newest first (-created_at) when no explicit order is given
    {
      method: ["GET"],
      matcher: "/admin/products",
      middlewares: [defaultAdminProductOrder],
    },
    // Translate Medusa Admin default option ("Default option" / "Default option value") to Turkish ("Varsayılan" / "Standart")
    {
      method: ["POST"],
      matcher: "/admin/products",
      middlewares: [normalizeDefaultProductOption],
    },
  ],
});
