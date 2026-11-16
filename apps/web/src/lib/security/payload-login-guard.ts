import { NextRequest, NextResponse } from "next/server";
import { extractClientIp } from "./origin-guard";
import { FixedWindowRateLimiter } from "./rate-limiter";

export const GENERIC_LOGIN_ERROR = "The email or password provided is incorrect.";

export interface PayloadLoginGuardOptions {
  maxRequests?: number;
  windowMs?: number;
}

const RATE_LIMITED_USER_ACTIONS = new Set(["login", "forgot-password", "reset-password"]);

export function isPayloadLoginPost(req: NextRequest, slug?: string[]): boolean {
  if (req.method !== "POST") return false;
  if (
    Array.isArray(slug) &&
    slug.length === 2 &&
    slug[0] === "users" &&
    RATE_LIMITED_USER_ACTIONS.has(slug[1])
  ) {
    return true;
  }
  const pathname = req.nextUrl?.pathname || "";
  return (
    pathname === "/api/users/login" ||
    pathname === "/api/users/forgot-password" ||
    pathname === "/api/users/reset-password"
  );
}

export async function maskLockedAccountResponse(res: Response): Promise<Response> {
  if (res.status < 400 || res.status >= 500) {
    return res;
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return res;
  }

  let body: any = null;
  try {
    body = await res.clone().json();
  } catch {
    return res;
  }

  const serialized = JSON.stringify(body || "");
  if (!/locked|kilitli/i.test(serialized)) {
    return res;
  }

  const headers = new Headers(res.headers);
  headers.delete("content-length");
  return NextResponse.json(
    {
      errors: [{ message: GENERIC_LOGIN_ERROR }],
    },
    { status: 401, headers },
  );
}

export function createPayloadLoginGuardedPost<
  TContext extends { params: Promise<{ slug?: string[] }> },
>(
  handler: (req: NextRequest, context: TContext) => Promise<Response>,
  options: PayloadLoginGuardOptions = {},
) {
  const limiter = new FixedWindowRateLimiter({
    maxRequests: options.maxRequests ?? 10,
    windowMs: options.windowMs ?? 15 * 60_000,
  });

  return async (req: NextRequest, context: TContext): Promise<Response> => {
    let slug: string[] | undefined;
    try {
      const resolved = await context?.params;
      slug = resolved?.slug;
    } catch {
      slug = undefined;
    }

    if (!isPayloadLoginPost(req, slug)) {
      return handler(req, context);
    }

    const clientIp = extractClientIp(req);
    const decision = limiter.consume(clientIp);
    if (!decision.allowed) {
      return NextResponse.json(
        {
          errors: [
            {
              message: "Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyiniz.",
            },
          ],
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(decision.retryAfterSeconds),
          },
        },
      );
    }

    const res = await handler(req, context);
    return maskLockedAccountResponse(res);
  };
}
