export interface HeaderEntry {
  key: string;
  value: string;
}

export interface HeaderRule {
  source: string;
  headers: HeaderEntry[];
}

export function buildStorefrontCsp(isProd: boolean): string {
  const devEval = isProd ? "" : " 'unsafe-eval'";
  const devImg = isProd ? "" : " http://localhost:* http://127.0.0.1:*";
  const devConnect = isProd ? "" : " http://localhost:* http://127.0.0.1:* ws: wss:";

  return [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    `script-src 'self' 'unsafe-inline'${devEval} https://www.paytr.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${devImg}`,
    "font-src 'self' data:",
    "frame-src 'self' https://www.paytr.com https://sandbox-cpp.iyzipay.com https://cpp.iyzipay.com",
    `connect-src 'self' https://www.paytr.com${devConnect}`,
    "form-action 'self' https://www.paytr.com https://sandbox-cpp.iyzipay.com https://cpp.iyzipay.com",
  ].join("; ");
}

export function buildAdminCsp(isProd: boolean): string {
  const devHosts = isProd ? "" : " http://localhost:* http://127.0.0.1:*";
  const devWs = isProd ? "" : " ws: wss:";

  return [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https:${devHosts}`,
    "font-src 'self' data:",
    "frame-src 'self'",
    `connect-src 'self'${devHosts}${devWs}`,
    "form-action 'self'",
  ].join("; ");
}

export function getSecurityHeadersConfig(isProd: boolean): HeaderRule[] {
  const rootHeaders: HeaderEntry[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy", value: buildStorefrontCsp(isProd) },
  ];

  if (isProd) {
    rootHeaders.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  const adminCsp = buildAdminCsp(isProd);

  const noStoreHeaders: HeaderEntry[] = [
    { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
    { key: "Pragma", value: "no-cache" },
  ];

  const noStoreSources = [
    "/sepet",
    "/sepet/:path*",
    "/odeme",
    "/odeme/:path*",
    "/hesap",
    "/siparis-onay",
    "/siparis-onay/:path*",
    "/siparis-takip",
    "/siparis-takip/:path*",
    "/onizleme",
    "/onizleme/:path*",
    "/admin",
    "/app",
    "/api/:path*",
    "/medusa-api/:path*",
  ];

  return [
    {
      source: "/hesap/:path*",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ...noStoreHeaders,
      ],
    },
    {
      source: "/:path*",
      headers: rootHeaders,
    },
    {
      source: "/admin/:path*",
      headers: [{ key: "Content-Security-Policy", value: adminCsp }, ...noStoreHeaders],
    },
    {
      source: "/app/:path*",
      headers: [{ key: "Content-Security-Policy", value: adminCsp }, ...noStoreHeaders],
    },
    ...noStoreSources.map((source) => ({
      source,
      headers: noStoreHeaders,
    })),
  ];
}
