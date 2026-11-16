import { EventEmitter } from "events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminLoginEmailGuard,
  adminLoginIpEmailGuard,
  adminLoginRateLimitGuard,
  extractMedusaClientIp,
} from "./middleware-guards";

function createEventMockRes() {
  const res = new EventEmitter() as EventEmitter & {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    status: (code: number) => typeof res;
    setHeader: (name: string, value: string) => typeof res;
    json: (payload: unknown) => typeof res;
  };
  res.statusCode = 200;
  res.headers = {};
  res.body = null;
  res.status = function (code: number) {
    this.statusCode = code;
    return this;
  };
  res.setHeader = function (name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  };
  res.json = function (payload: unknown) {
    this.body = payload;
    return this;
  };
  return res;
}

describe("Medusa Admin Login Rate Limit (/auth/user/emailpass)", () => {
  const origTrustProxy = process.env.TRUST_PROXY;
  const origHops = process.env.TRUSTED_PROXY_HOPS;
  const origEncKey = process.env.SETTINGS_ENCRYPTION_KEY;

  beforeEach(() => {
    delete process.env.TRUST_PROXY;
    delete process.env.TRUSTED_PROXY_HOPS;
    process.env.SETTINGS_ENCRYPTION_KEY =
      "4e091da86e2b155c5697ee55ab2b5dd54bce76b9df9a9628546b4c3d9e9b827f";
  });

  afterEach(() => {
    process.env.TRUST_PROXY = origTrustProxy;
    process.env.TRUSTED_PROXY_HOPS = origHops;
    process.env.SETTINGS_ENCRYPTION_KEY = origEncKey;
  });

  it("extractMedusaClientIp ignores X-Forwarded-For and X-Real-IP when TRUST_PROXY is off", () => {
    const req = {
      headers: {
        "x-forwarded-for": "198.51.100.42",
        "x-real-ip": "198.51.100.99",
      },
      socket: { remoteAddress: "127.0.0.1" },
    };
    expect(extractMedusaClientIp(req)).toBe("127.0.0.1");
  });

  it("blocks after 5 failed attempts per IP+email and ignores spoofed headers", () => {
    const email = "admin-test-1@example.test";
    for (let i = 0; i < 5; i++) {
      const req = {
        headers: {
          "x-forwarded-for": `192.0.2.${i + 1}`,
          "x-real-ip": `192.0.2.${i + 100}`,
        },
        socket: { remoteAddress: "10.0.0.1" },
        body: { email },
      };
      const res = createEventMockRes();
      const next = vi.fn(() => {
        res.statusCode = 401;
        res.emit("finish");
      });
      adminLoginRateLimitGuard(req as any, res as any, next);
      expect(next).toHaveBeenCalledOnce();
    }

    // 6th attempt from same socket IP (even with different XFF) -> 429
    const blockedReq = {
      headers: { "x-forwarded-for": "203.0.113.55" },
      socket: { remoteAddress: "10.0.0.1" },
      body: { email },
    };
    const blockedRes = createEventMockRes();
    const blockedNext = vi.fn();
    adminLoginRateLimitGuard(blockedReq as any, blockedRes as any, blockedNext);
    expect(blockedRes.statusCode).toBe(429);
    expect(blockedNext).not.toHaveBeenCalled();

    // Another email from same IP is NOT blocked
    const otherReq = {
      headers: {},
      socket: { remoteAddress: "10.0.0.1" },
      body: { email: "admin-other@example.test" },
    };
    const otherRes = createEventMockRes();
    const otherNext = vi.fn(() => {
      otherRes.statusCode = 200;
      otherRes.emit("finish");
    });
    adminLoginRateLimitGuard(otherReq as any, otherRes as any, otherNext);
    expect(otherNext).toHaveBeenCalledOnce();
    expect(otherRes.statusCode).toBe(200);
  });

  it("blocks after 15 failed attempts for the same email across different IPs (when TRUST_PROXY=true)", () => {
    process.env.TRUST_PROXY = "true";
    process.env.TRUSTED_PROXY_HOPS = "1";
    const email = "admin-test-email-only@example.test";

    for (let i = 0; i < 15; i++) {
      const req = {
        headers: { "x-forwarded-for": `198.51.100.${i + 10}` },
        socket: { remoteAddress: "127.0.0.1" },
        body: { email },
      };
      const res = createEventMockRes();
      const next = vi.fn(() => {
        res.statusCode = 401;
        res.emit("finish");
      });
      adminLoginRateLimitGuard(req as any, res as any, next);
      expect(next).toHaveBeenCalledOnce();
    }

    // 16th attempt from brand new IP -> blocked by email-only guard
    const req16 = {
      headers: { "x-forwarded-for": "203.0.113.200" },
      socket: { remoteAddress: "127.0.0.1" },
      body: { email },
    };
    const res16 = createEventMockRes();
    const next16 = vi.fn();
    adminLoginRateLimitGuard(req16 as any, res16 as any, next16);
    expect(res16.statusCode).toBe(429);
    expect(next16).not.toHaveBeenCalled();
  });

  it("allows unlimited successful logins and clears only own IP+email counter on 200", () => {
    const email = "admin-success@example.test";
    // 3 failed attempts
    for (let i = 0; i < 3; i++) {
      const req = {
        headers: {},
        socket: { remoteAddress: "10.0.0.5" },
        body: { email },
      };
      const res = createEventMockRes();
      adminLoginRateLimitGuard(req as any, res as any, () => {
        res.statusCode = 401;
        res.emit("finish");
      });
    }

    // Successful login resets IP+email counter
    const okReq = {
      headers: {},
      socket: { remoteAddress: "10.0.0.5" },
      body: { email },
    };
    const okRes = createEventMockRes();
    adminLoginRateLimitGuard(okReq as any, okRes as any, () => {
      okRes.statusCode = 200;
      okRes.emit("finish");
    });

    // 4 more failed attempts should still be allowed (since counter was reset)
    for (let i = 0; i < 4; i++) {
      const req = {
        headers: {},
        socket: { remoteAddress: "10.0.0.5" },
        body: { email },
      };
      const res = createEventMockRes();
      const next = vi.fn(() => {
        res.statusCode = 401;
        res.emit("finish");
      });
      adminLoginRateLimitGuard(req as any, res as any, next);
      expect(next).toHaveBeenCalledOnce();
    }

    expect(adminLoginIpEmailGuard).toBeDefined();
    expect(adminLoginEmailGuard).toBeDefined();
  });
});
