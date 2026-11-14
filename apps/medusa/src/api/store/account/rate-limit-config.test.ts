import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RATE_LIMIT_OVERRIDE_ENV_VARS,
  assertNoRateLimitOverridesInProduction,
  getAccountRateLimitConfig,
} from "./rate-limit-config";

describe("account rate-limit config & production startup guard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of RATE_LIMIT_OVERRIDE_ENV_VARS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns production defaults when no override env vars are set", () => {
    const cfg = getAccountRateLimitConfig();
    expect(cfg).toEqual({
      registerIpLimitMax: 5,
      registerEmailLimitMax: 5,
      loginIpLimitMax: 30,
      loginIpEmailMaxFailures: 5,
      loginEmailMaxFailures: 20,
      resetIpLimitMax: 10,
      resetEmailLimitMax: 3,
      tokenConfirmIpLimitMax: 10,
      resendVerificationLimitMax: 3,
    });
  });

  it("reads valid positive integer overrides from env", () => {
    process.env.REGISTER_IP_LIMIT_MAX = "50";
    const cfg = getAccountRateLimitConfig();
    expect(cfg.registerIpLimitMax).toBe(50);
    expect(cfg.loginIpEmailMaxFailures).toBe(5);
    expect(cfg.loginEmailMaxFailures).toBe(20);
    expect(cfg.resetIpLimitMax).toBe(10);
  });

  it("rejects non-positive or non-numeric override values (fail-closed)", () => {
    process.env.REGISTER_IP_LIMIT_MAX = "0";
    expect(() => getAccountRateLimitConfig()).toThrow(/REGISTER_IP_LIMIT_MAX/);

    process.env.REGISTER_IP_LIMIT_MAX = "abc";
    expect(() => getAccountRateLimitConfig()).toThrow(/REGISTER_IP_LIMIT_MAX/);
  });

  it("allows rate limit override env vars in non-production environments", () => {
    process.env.REGISTER_IP_LIMIT_MAX = "50";
    expect(() => assertNoRateLimitOverridesInProduction("development")).not.toThrow();
    expect(() => assertNoRateLimitOverridesInProduction("test")).not.toThrow();
  });

  it("throws FAIL-CLOSED in production when any rate limit override env var is set", () => {
    for (const envVar of RATE_LIMIT_OVERRIDE_ENV_VARS) {
      process.env[envVar] = "99";
      expect(() => assertNoRateLimitOverridesInProduction("production")).toThrow(
        new RegExp(`FAIL-CLOSED: ${envVar}`),
      );
      delete process.env[envVar];
    }
  });
});
