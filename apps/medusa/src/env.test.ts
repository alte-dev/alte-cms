import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as envModule from "./env";

describe("Medusa Environment & Cookie Security Defaults", () => {
  const originalEnv = process.env;

  const validBaseEnv = {
    DATABASE_URL: "postgres://user:pass@127.0.0.1:5432/medusa_db",
    REDIS_URL: "redis://127.0.0.1:6379",
    JWT_SECRET: "a-very-strong-random-jwt-secret-at-least-32-chars",
    COOKIE_SECRET: "a-very-strong-random-cookie-secret-at-least-32-chars",
    STORE_CORS: "http://localhost:3100",
    ADMIN_CORS: "http://localhost:9000",
    AUTH_CORS: "http://localhost:9000",
    SETTINGS_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    INTERNAL_API_SECRET: "a-very-strong-random-internal-secret-at-least-32-chars",
  };

  beforeEach(() => {
    process.env = { ...originalEnv, ...validBaseEnv };
    delete process.env.COOKIE_SECURE;
    delete process.env.API_PUBLIC_URL;
    delete process.env.PAYTR_API_BASE;
    delete process.env.DEV_PAYTR_USER_IP;
    delete process.env.MEDUSA_ADMIN_BACKEND_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("defaults cookie secure to true when NODE_ENV is production and COOKIE_SECURE is unset", () => {
    const resolveCookieSecure = (envModule as Record<string, unknown>).resolveCookieSecure as (
      env?: NodeJS.ProcessEnv,
    ) => boolean;
    expect(typeof resolveCookieSecure).toBe("function");
    expect(resolveCookieSecure({ NODE_ENV: "production" })).toBe(true);
  });

  it("throws a fail-closed security error in validateMedusaEnv when NODE_ENV=production and COOKIE_SECURE=false", () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "false";

    expect(() => envModule.validateMedusaEnv()).toThrow(/COOKIE_SECURE=false/);
  });

  it("keeps cookie secure false on local HTTP development (NODE_ENV=development) when COOKIE_SECURE is unset", () => {
    const resolveCookieSecure = (envModule as Record<string, unknown>).resolveCookieSecure as (
      env?: NodeJS.ProcessEnv,
    ) => boolean;
    expect(typeof resolveCookieSecure).toBe("function");
    expect(
      resolveCookieSecure({ NODE_ENV: "development", API_PUBLIC_URL: "http://localhost:9000" }),
    ).toBe(false);
  });

  it("allows explicit COOKIE_SECURE=false outside production even if API_PUBLIC_URL is https", () => {
    const resolveCookieSecure = (envModule as Record<string, unknown>).resolveCookieSecure as (
      env?: NodeJS.ProcessEnv,
    ) => boolean;
    expect(typeof resolveCookieSecure).toBe("function");
    expect(
      resolveCookieSecure({
        NODE_ENV: "development",
        COOKIE_SECURE: "false",
        API_PUBLIC_URL: "https://api.example.test",
      }),
    ).toBe(false);
  });

  it("enables cookie secure outside production when COOKIE_SECURE=true or API_PUBLIC_URL is https", () => {
    const resolveCookieSecure = (envModule as Record<string, unknown>).resolveCookieSecure as (
      env?: NodeJS.ProcessEnv,
    ) => boolean;
    expect(typeof resolveCookieSecure).toBe("function");
    expect(resolveCookieSecure({ NODE_ENV: "development", COOKIE_SECURE: "true" })).toBe(true);
    expect(
      resolveCookieSecure({ NODE_ENV: "development", API_PUBLIC_URL: "https://api.example.test" }),
    ).toBe(true);
  });

  it("leaves admin.backendUrl undefined when MEDUSA_ADMIN_BACKEND_URL is unset in production", () => {
    process.env.NODE_ENV = "production";
    const parsed = envModule.validateMedusaEnv();
    expect(parsed.MEDUSA_ADMIN_BACKEND_URL).toBeUndefined();
  });

  it("throws fail-closed when INTERNAL_API_SECRET is missing or weak", () => {
    delete process.env.INTERNAL_API_SECRET;
    expect(() => envModule.validateMedusaEnv()).toThrow();

    process.env.INTERNAL_API_SECRET = "secret-internal-key-that-is-32-chars!";
    expect(() => envModule.validateMedusaEnv()).toThrow();
  });
});
