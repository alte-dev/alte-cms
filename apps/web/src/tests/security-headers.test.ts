import { describe, expect, it } from "vitest";
import {
  buildAdminCsp,
  buildStorefrontCsp,
  getSecurityHeadersConfig,
} from "../lib/security/headers";

describe("Security Headers & CSP", () => {
  it("production storefront CSP excludes unsafe-eval, localhost, 127.0.0.1, ws:, wss: and includes strict directives", () => {
    const csp = buildStorefrontCsp(true);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).toContain(
      "form-action 'self' https://www.paytr.com https://sandbox-cpp.iyzipay.com https://cpp.iyzipay.com",
    );
    expect(csp).toContain(
      "frame-src 'self' https://www.paytr.com https://sandbox-cpp.iyzipay.com https://cpp.iyzipay.com",
    );
    expect(csp).toContain("https://sandbox-static.iyzipay.com https://static.iyzipay.com");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("localhost");
    expect(csp).not.toContain("127.0.0.1");
    expect(csp).not.toContain("ws:");
    expect(csp).not.toContain("wss:");
  });

  it("development storefront CSP allows unsafe-eval and local HMR/API hosts", () => {
    const csp = buildStorefrontCsp(false);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("http://localhost:*");
    expect(csp).toContain("ws:");
  });

  it("includes HSTS (without preload) only in production and Permissions-Policy always", () => {
    const prodRules = getSecurityHeadersConfig(true);
    const rootProd = prodRules.find((r) => r.source === "/:path*");
    expect(rootProd).toBeDefined();
    const hsts = rootProd!.headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts?.value).toBe("max-age=31536000; includeSubDomains");
    expect(hsts?.value).not.toContain("preload");
    const perm = rootProd!.headers.find((h) => h.key === "Permissions-Policy");
    expect(perm?.value).toContain("camera=()");
    expect(perm?.value).toContain("microphone=()");
    expect(perm?.value).toContain("geolocation=()");

    const devRules = getSecurityHeadersConfig(false);
    const rootDev = devRules.find((r) => r.source === "/:path*");
    expect(rootDev!.headers.find((h) => h.key === "Strict-Transport-Security")).toBeUndefined();
  });

  it("admin CSP includes default-src, object-src, base-uri, frame-ancestors", () => {
    const adminCsp = buildAdminCsp(true);
    expect(adminCsp).toContain("default-src 'self'");
    expect(adminCsp).toContain("object-src 'none'");
    expect(adminCsp).toContain("base-uri 'self'");
    expect(adminCsp).toContain("frame-ancestors 'self'");
  });
});
