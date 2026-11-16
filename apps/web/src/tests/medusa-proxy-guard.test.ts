import { describe, expect, it } from "vitest";
import { isAllowedMedusaProxyPath } from "../lib/security/medusa-proxy-guard";

describe("Medusa Proxy Allowlist & Traversal Guard (/medusa-api/*)", () => {
  it("allows valid admin and user-auth paths", () => {
    expect(isAllowedMedusaProxyPath("/medusa-api/admin/products")).toBe(true);
    expect(isAllowedMedusaProxyPath("/medusa-api/admin/orders/ord_123")).toBe(true);
    expect(isAllowedMedusaProxyPath("/medusa-api/auth/user/emailpass")).toBe(true);
    expect(isAllowedMedusaProxyPath("/medusa-api/auth/user/providers")).toBe(true);
    expect(isAllowedMedusaProxyPath("/medusa-api/auth/session")).toBe(true);
    expect(isAllowedMedusaProxyPath("/medusa-api/auth/token/refresh")).toBe(true);
  });

  it("blocks direct non-allowlisted paths", () => {
    expect(isAllowedMedusaProxyPath("/medusa-api/store/products")).toBe(false);
    expect(isAllowedMedusaProxyPath("/medusa-api/hooks/payment/pp_paytr_paytr")).toBe(false);
    expect(isAllowedMedusaProxyPath("/medusa-api/internal/admin-sso")).toBe(false);
    expect(isAllowedMedusaProxyPath("/medusa-api/auth/customer/emailpass")).toBe(false);
  });

  it("blocks encoded and raw path traversal, double encoding, backslashes, null bytes, semicolons, and double slashes", () => {
    const attacks = [
      "/medusa-api/admin/%2e%2e/store/products",
      "/medusa-api/admin/%2E%2E/store/products",
      "/medusa-api/auth/user/%2e%2e/%2e%2e/store/products",
      "/medusa-api/admin/..%2fstore/products",
      "/medusa-api/admin/%252e%252e/store/products",
      "/medusa-api/admin/%252f/store/products",
      "/medusa-api/admin/./../store/products",
      "/medusa-api/admin/./products",
      "/medusa-api/admin//..//store/products",
      "/medusa-api/admin//products",
      "/medusa-api/admin/..\\store/products",
      "/medusa-api/admin/%5cstore/products",
      "/medusa-api/admin/products%00.json",
      "/medusa-api/admin/products;foo=bar",
    ];

    for (const attack of attacks) {
      expect(isAllowedMedusaProxyPath(attack), `Expected 404/false for ${attack}`).toBe(false);
    }
  });
});
