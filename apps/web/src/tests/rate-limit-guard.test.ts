import { afterEach, describe, expect, it } from "vitest";
import { RATE_LIMIT_OVERRIDE_ENV_VARS, assertNoRateLimitOverridesInProduction } from "@alte/shared";

describe("Web & Shared Rate Limit Override Production Guard", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("includes CHECKOUT_IP_LIMIT_MAX and IYZICO_CALLBACK_LIMIT_MAX in shared RATE_LIMIT_OVERRIDE_ENV_VARS", () => {
    expect(RATE_LIMIT_OVERRIDE_ENV_VARS).toContain("CHECKOUT_IP_LIMIT_MAX");
    expect(RATE_LIMIT_OVERRIDE_ENV_VARS).toContain("IYZICO_CALLBACK_LIMIT_MAX");
  });

  it("throws FAIL-CLOSED in production when CHECKOUT_IP_LIMIT_MAX or IYZICO_CALLBACK_LIMIT_MAX is set", () => {
    process.env.CHECKOUT_IP_LIMIT_MAX = "100";
    expect(() => assertNoRateLimitOverridesInProduction("production")).toThrow(/FAIL-CLOSED/);
    delete process.env.CHECKOUT_IP_LIMIT_MAX;

    process.env.IYZICO_CALLBACK_LIMIT_MAX = "100";
    expect(() => assertNoRateLimitOverridesInProduction("production")).toThrow(/FAIL-CLOSED/);
    expect(() => assertNoRateLimitOverridesInProduction("development")).not.toThrow();
  });
});
