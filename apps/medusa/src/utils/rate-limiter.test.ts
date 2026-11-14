import { describe, expect, it } from "vitest";
import { BruteForceGuard, FixedWindowRateLimiter } from "./rate-limiter";

describe("FixedWindowRateLimiter", () => {
  it("allows up to maxRequests within window and rejects after", () => {
    let now = 1000;
    const limiter = new FixedWindowRateLimiter({
      maxRequests: 3,
      windowMs: 60_000,
      now: () => now,
    });

    expect(limiter.consume("ip1").allowed).toBe(true);
    expect(limiter.consume("ip1").allowed).toBe(true);
    expect(limiter.consume("ip1").allowed).toBe(true);
    const blocked = limiter.consume("ip1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Different key is unaffected
    expect(limiter.consume("ip2").allowed).toBe(true);

    // After window expires, resets
    now += 61_000;
    expect(limiter.consume("ip1").allowed).toBe(true);
  });
});

describe("BruteForceGuard", () => {
  it("locks key after maxFailures and unlocks after blockDurationMs or clear()", () => {
    let now = 5000;
    const guard = new BruteForceGuard({
      maxFailures: 5,
      blockDurationMs: 15 * 60_000,
      now: () => now,
    });

    for (let i = 0; i < 4; i++) {
      guard.recordFailure("k1");
      expect(guard.check("k1").allowed).toBe(true);
    }

    guard.recordFailure("k1");
    const locked = guard.check("k1");
    expect(locked.allowed).toBe(false);
    expect(locked.remainingMinutes).toBe(15);

    // Clear resets lock
    guard.clear("k1");
    expect(guard.check("k1").allowed).toBe(true);

    // Re-lock and let block expire
    for (let i = 0; i < 5; i++) guard.recordFailure("k2");
    expect(guard.check("k2").allowed).toBe(false);
    now += 15 * 60_000 + 1;
    expect(guard.check("k2").allowed).toBe(true);
  });
});
