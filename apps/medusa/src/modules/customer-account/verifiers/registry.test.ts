import { afterEach, describe, expect, it } from "vitest";
import { LegacyVerifierRegistry } from "./registry";
import type { LegacyPasswordVerifier } from "./types";

describe("LegacyVerifierRegistry", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("allows registering and verifying a test verifier outside production", async () => {
    process.env.NODE_ENV = "test";
    const registry = new LegacyVerifierRegistry();
    const fakeVerifier: LegacyPasswordVerifier = {
      algorithm: "fake-test",
      async verify(password: string, legacyHash: string) {
        return legacyHash === `fake:${password}`;
      },
    };

    registry.register(fakeVerifier);
    expect(registry.has("fake-test")).toBe(true);
    expect(await registry.verify("fake-test", "MyPass12345", "fake:MyPass12345")).toBe(true);
    expect(await registry.verify("fake-test", "WrongPass123", "fake:MyPass12345")).toBe(false);
  });

  it("fails closed when an unknown algorithm is queried", async () => {
    const registry = new LegacyVerifierRegistry();
    expect(registry.has("phpass")).toBe(false);
    expect(await registry.verify("phpass", "anything123", "$P$B123")).toBe(false);
  });

  it("forbids registering test verifiers in production", () => {
    process.env.NODE_ENV = "production";
    const registry = new LegacyVerifierRegistry();
    expect(() =>
      registry.register({
        algorithm: "fake-test",
        async verify() {
          return true;
        },
      }),
    ).toThrow(/production/i);
  });
});
