import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractClientIp, verifyAccountOrigin } from "../lib/security/origin-guard";

describe("verifyAccountOrigin (CSRF / Origin+Host Guard)", () => {
  const originalServerUrl = process.env.NEXT_PUBLIC_SERVER_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SERVER_URL = "http://localhost:3100";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SERVER_URL = originalServerUrl;
  });

  it("allows matching Origin and Host", () => {
    const req = new Request("http://localhost:3100/api/account/login", {
      method: "POST",
      headers: {
        origin: "http://localhost:3100",
        host: "localhost:3100",
      },
    });
    expect(verifyAccountOrigin(req).allowed).toBe(true);
  });

  it("rejects missing Origin header (fail-closed)", () => {
    const req = new Request("http://localhost:3100/api/account/login", {
      method: "POST",
      headers: {
        host: "localhost:3100",
      },
    });
    expect(verifyAccountOrigin(req).allowed).toBe(false);
  });

  it("rejects foreign Origin header", () => {
    const req = new Request("http://localhost:3100/api/account/login", {
      method: "POST",
      headers: {
        origin: "https://evil.example.test",
        host: "localhost:3100",
      },
    });
    expect(verifyAccountOrigin(req).allowed).toBe(false);
  });

  it("rejects mismatched Host header", () => {
    const req = new Request("http://localhost:3100/api/account/login", {
      method: "POST",
      headers: {
        origin: "http://localhost:3100",
        host: "evil.example.test:3100",
      },
    });
    expect(verifyAccountOrigin(req).allowed).toBe(false);
  });
});

describe("extractClientIp (fail-closed proxy IP extraction)", () => {
  const originalTrustProxy = process.env.TRUST_PROXY;
  const originalHops = process.env.TRUSTED_PROXY_HOPS;

  afterEach(() => {
    process.env.TRUST_PROXY = originalTrustProxy;
    process.env.TRUSTED_PROXY_HOPS = originalHops;
  });

  it("ignores x-real-ip, x-forwarded-for, and forwarded when TRUST_PROXY is unset/false", () => {
    delete process.env.TRUST_PROXY;
    const req = new Request("http://localhost:3100/api/account/login", {
      method: "POST",
      headers: {
        "x-real-ip": "10.1.1.1",
        "x-forwarded-for": "10.1.1.2, 10.1.1.3",
        forwarded: "for=10.1.1.4",
      },
    });
    expect(extractClientIp(req)).toBe("unknown");

    process.env.TRUST_PROXY = "false";
    expect(extractClientIp(req)).toBe("unknown");
  });

  it("uses trailing entry according to TRUSTED_PROXY_HOPS when TRUST_PROXY=true", () => {
    process.env.TRUST_PROXY = "true";
    process.env.TRUSTED_PROXY_HOPS = "1";
    const req = new Request("http://localhost:3100/api/account/login", {
      method: "POST",
      headers: {
        "x-real-ip": "198.51.100.99",
        "x-forwarded-for": "203.0.113.1, 198.51.100.10",
      },
    });
    expect(extractClientIp(req)).toBe("198.51.100.10");

    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(extractClientIp(req)).toBe("203.0.113.1");
  });

  it("supports IPv6 and falls back to unknown on invalid IP or insufficient hops", () => {
    process.env.TRUST_PROXY = "true";
    process.env.TRUSTED_PROXY_HOPS = "1";

    const v6Req = new Request("http://localhost:3100/api/account/login", {
      method: "POST",
      headers: { "x-forwarded-for": "2001:db8::1" },
    });
    expect(extractClientIp(v6Req)).toBe("2001:db8::1");

    const invalidReq = new Request("http://localhost:3100/api/account/login", {
      method: "POST",
      headers: { "x-forwarded-for": "not-an-ip" },
    });
    expect(extractClientIp(invalidReq)).toBe("unknown");

    process.env.TRUSTED_PROXY_HOPS = "3";
    const shortReq = new Request("http://localhost:3100/api/account/login", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.1, 198.51.100.10" },
    });
    expect(extractClientIp(shortReq)).toBe("unknown");
  });
});
