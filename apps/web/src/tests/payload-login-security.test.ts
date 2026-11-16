import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createPayloadLoginGuardedPost,
  maskLockedAccountResponse,
} from "../lib/security/payload-login-guard";

describe("Payload Login Rate Limit & Locked Account Masking", () => {
  it("rate-limits POST /api/users/login per IP and ignores GET or other slugs", async () => {
    const innerPost = vi.fn(async () =>
      NextResponse.json(
        { errors: [{ message: "The email or password provided is incorrect." }] },
        { status: 401 },
      ),
    );
    const guardedPost = createPayloadLoginGuardedPost(innerPost, {
      maxRequests: 5,
      windowMs: 15 * 60_000,
    });

    for (let i = 0; i < 5; i++) {
      const req = new NextRequest("http://localhost:3100/api/users/login", {
        method: "POST",
      });
      const res = await guardedPost(req, { params: Promise.resolve({ slug: ["users", "login"] }) });
      expect(res.status).toBe(401);
    }

    // 6th request -> 429 with Retry-After
    const req6 = new NextRequest("http://localhost:3100/api/users/login", {
      method: "POST",
    });
    const res6 = await guardedPost(req6, { params: Promise.resolve({ slug: ["users", "login"] }) });
    expect(res6.status).toBe(429);
    expect(res6.headers.get("Retry-After")).toBeTruthy();
    expect(innerPost).toHaveBeenCalledTimes(5);

    // Other Payload POST routes (e.g. /api/pages) are not rate-limited by login limiter
    const otherReq = new NextRequest("http://localhost:3100/api/pages", {
      method: "POST",
    });
    const otherRes = await guardedPost(otherReq, { params: Promise.resolve({ slug: ["pages"] }) });
    expect(otherRes.status).toBe(401);
  });

  it("rate-limits POST /api/users/forgot-password and /api/users/reset-password", async () => {
    const innerPost = vi.fn(async () => NextResponse.json({ message: "ok" }, { status: 200 }));
    const guardedPost = createPayloadLoginGuardedPost(innerPost, {
      maxRequests: 3,
      windowMs: 15 * 60_000,
    });

    for (const action of ["forgot-password", "reset-password"]) {
      const r = new NextRequest(`http://localhost:3100/api/users/${action}`, { method: "POST" });
      const res = await guardedPost(r, { params: Promise.resolve({ slug: ["users", action] }) });
      expect(res.status).toBe(200);
    }

    const r3 = new NextRequest("http://localhost:3100/api/users/forgot-password", {
      method: "POST",
    });
    expect(
      (await guardedPost(r3, { params: Promise.resolve({ slug: ["users", "forgot-password"] }) }))
        .status,
    ).toBe(200);

    // 4th attempt exceeds limit -> 429
    const r4 = new NextRequest("http://localhost:3100/api/users/reset-password", {
      method: "POST",
    });
    const res4 = await guardedPost(r4, {
      params: Promise.resolve({ slug: ["users", "reset-password"] }),
    });
    expect(res4.status).toBe(429);
    expect(res4.headers.get("Retry-After")).toBeTruthy();
  });

  it("masks Payload locked user error into generic invalid credentials response", async () => {
    const lockedRes = NextResponse.json(
      {
        errors: [
          {
            message:
              "This user is locked due to having too many failed login attempts. Please try again later.",
          },
        ],
      },
      { status: 401 },
    );

    const masked = await maskLockedAccountResponse(lockedRes);
    const body = await masked.json();
    expect(masked.status).toBe(401);
    expect(JSON.stringify(body)).not.toContain("locked");
    expect(body.errors?.[0]?.message).toBe("The email or password provided is incorrect.");
  });
});
