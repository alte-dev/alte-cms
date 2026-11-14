import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyAccountOrigin } from "../lib/security/origin-guard";

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
