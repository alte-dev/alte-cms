import { describe, it, expect, beforeEach } from "vitest";
import { webEnvSchema } from "../env";

describe("Web/Payload Environment Schema Validation (Fail-Closed)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it("should fail when mandatory environment variables are missing", () => {
    const invalidConfig = {
      NEXT_PUBLIC_SERVER_URL: "http://localhost:3100",
      // DATABASE_URI missing
      PAYLOAD_SECRET: "strong-random-payload-secret-at-least-32-chars!",
      NEXT_PUBLIC_MEDUSA_URL: "http://api.localhost:9000",
      MEDUSA_BACKEND_URL: "http://127.0.0.1:9000",
    };

    const result = webEnvSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("DATABASE_URI"))).toBe(true);
    }
  });

  it("should reject weak/trivial PAYLOAD_SECRET values", () => {
    const weakConfig = {
      NEXT_PUBLIC_SERVER_URL: "http://localhost:3100",
      DATABASE_URI: "postgres://payload_user:dev-only-payload-password@127.0.0.1:5432/payload_db",
      PAYLOAD_SECRET: "secret123secret123secret123secret123", // starts with secret
      NEXT_PUBLIC_MEDUSA_URL: "http://api.localhost:9000",
      MEDUSA_BACKEND_URL: "http://127.0.0.1:9000",
    };

    const result = webEnvSchema.safeParse(weakConfig);
    expect(result.success).toBe(false);
  });

  it("should succeed with a valid and secure configuration", () => {
    const validConfig = {
      NEXT_PUBLIC_SERVER_URL: "http://localhost:3100",
      DATABASE_URI: "postgres://payload_user:dev-only-payload-password@127.0.0.1:5432/payload_db",
      PAYLOAD_SECRET: "strong-random-payload-secret-at-least-32-chars!",
      NEXT_PUBLIC_MEDUSA_URL: "http://api.localhost:9000",
      MEDUSA_BACKEND_URL: "http://127.0.0.1:9000",
      PAYLOAD_MEDIA_DIR: "media/uploads",
      TRUST_PROXY: "true",
      NEXT_OUTPUT_STANDALONE: "false",
    };

    const result = webEnvSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });
});
