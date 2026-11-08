import { describe, it, expect, beforeEach } from "vitest";
import { medusaEnvSchema, validateMedusaEnv } from "./env";

describe("Medusa Environment Schema Validation (Fail-Closed)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("should fail when mandatory environment variables are missing", () => {
    const invalidConfig = {
      DATABASE_URL: "postgres://user:pass@localhost:5432/medusa_db",
      // REDIS_URL missing
      JWT_SECRET: "strong-random-jwt-secret-min-32-chars-long!",
      COOKIE_SECRET: "strong-random-cookie-secret-min-32-chars!",
      STORE_CORS: "http://localhost:3100",
      ADMIN_CORS: "http://api.localhost:9000",
      AUTH_CORS: "http://api.localhost:9000",
    };

    const result = medusaEnvSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("REDIS_URL"))).toBe(true);
    }
  });

  it("should reject weak/trivial secrets even if they meet length requirement", () => {
    const weakConfig = {
      DATABASE_URL: "postgres://user:pass@localhost:5432/medusa_db",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "secret123secret123secret123secret123", // starts with secret
      COOKIE_SECRET: "passwordpasswordpasswordpassword123", // weak pattern
      STORE_CORS: "http://localhost:3100",
      ADMIN_CORS: "http://api.localhost:9000",
      AUTH_CORS: "http://api.localhost:9000",
    };

    const result = medusaEnvSchema.safeParse(weakConfig);
    expect(result.success).toBe(false);
  });

  it("should succeed with a secure, complete configuration", () => {
    const validConfig = {
      DATABASE_URL: "postgres://medusa_user:dev-only-medusa-password@127.0.0.1:5432/medusa_db",
      REDIS_URL: "redis://127.0.0.1:6379",
      JWT_SECRET: "super-secure-unique-jwt-signing-key-32-chars-ok",
      COOKIE_SECRET: "super-secure-unique-cookie-session-key-32-chars",
      STORE_CORS: "http://localhost:3100",
      ADMIN_CORS: "http://api.localhost:9000,http://localhost:9000",
      AUTH_CORS: "http://api.localhost:9000,http://localhost:3100",
      PORT: "9000",
      HOST: "127.0.0.1",
      SETTINGS_ENCRYPTION_KEY: "4e091da86e2b155c5697ee55ab2b5dd54bce76b9df9a9628546b4c3d9e9b827f",
    };

    const result = medusaEnvSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it("should reject PAYTR_API_BASE and DEV_PAYTR_USER_IP in production", () => {
    process.env.NODE_ENV = "production";
    process.env.PAYTR_API_BASE = "https://mock-paytr.test";
    expect(() => validateMedusaEnv()).toThrow(/PAYTR_API_BASE/);

    delete process.env.PAYTR_API_BASE;
    process.env.DEV_PAYTR_USER_IP = "1.2.3.4";
    expect(() => validateMedusaEnv()).toThrow(/DEV_PAYTR_USER_IP/);
  });
});
