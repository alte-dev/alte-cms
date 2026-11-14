import { afterEach, describe, expect, it } from "vitest";
import { hasValidInternalSecret } from "../../middleware-guards";
import { getTrustedClientIp } from "./_shared";

describe("getTrustedClientIp & internal secret boundary", () => {
  const originalSecret = process.env.INTERNAL_API_SECRET;

  afterEach(() => {
    process.env.INTERNAL_API_SECRET = originalSecret;
  });

  it("extracts x-alte-client-ip or falls back to unknown", () => {
    expect(getTrustedClientIp({ headers: { "x-alte-client-ip": "203.0.113.5" } })).toBe(
      "203.0.113.5",
    );
    expect(getTrustedClientIp({ headers: {} })).toBe("unknown");
    expect(getTrustedClientIp({ headers: { "x-real-ip": "10.0.0.1" } })).toBe("unknown");
  });

  it("rejects requests without valid X-Alte-Internal secret (fail-closed)", () => {
    process.env.INTERNAL_API_SECRET = "a".repeat(32);
    expect(hasValidInternalSecret({ headers: {} })).toBe(false);
    expect(hasValidInternalSecret({ headers: { "x-alte-internal": "wrong" } })).toBe(false);
    expect(hasValidInternalSecret({ headers: { "x-alte-internal": "a".repeat(32) } })).toBe(true);
  });
});
