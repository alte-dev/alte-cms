import { defineMiddlewares } from "@medusajs/framework/http";
import {
  blockCustomerTokenRefresh,
  blockRoute,
  customerSessionGuard,
  orderOwnershipGuard,
  requireInternalSecret,
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
    // Prevent bypassing registration via direct POST /store/customers
    {
      method: ["POST"],
      matcher: "/store/customers",
      middlewares: [requireInternalSecret],
    },
    // Enforce server-side session revocation on Medusa built-in customer & order routes
    {
      matcher: "/store/customers/me",
      middlewares: [customerSessionGuard],
    },
    {
      matcher: "/store/orders",
      middlewares: [customerSessionGuard],
    },
    {
      matcher: "/auth/session",
      middlewares: [customerSessionGuard],
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
  ],
});
