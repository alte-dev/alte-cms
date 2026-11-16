import { NextRequest, NextResponse } from "next/server";
import { buildAdminCsp } from "./lib/security/headers";
import { isAllowedMedusaProxyPath } from "./lib/security/medusa-proxy-guard";

export function middleware(req: NextRequest) {
  let rawPathname = req.nextUrl.pathname;
  try {
    rawPathname = new URL(req.url).pathname;
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (rawPathname.startsWith("/medusa-api") || req.nextUrl.pathname.startsWith("/medusa-api")) {
    if (!isAllowedMedusaProxyPath(rawPathname) || !isAllowedMedusaProxyPath(req.nextUrl.pathname)) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return NextResponse.next();
  }

  if (req.nextUrl.pathname === "/app" || req.nextUrl.pathname.startsWith("/app/")) {
    const res = NextResponse.next();
    res.headers.set(
      "Content-Security-Policy",
      buildAdminCsp(process.env.NODE_ENV === "production"),
    );
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/medusa-api/:path*", "/app", "/app/:path*"],
};
