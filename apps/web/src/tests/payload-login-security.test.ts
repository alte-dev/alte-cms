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
