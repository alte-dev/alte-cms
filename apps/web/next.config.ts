import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
const remotePatterns: Array<{
  protocol: "http" | "https";
  hostname: string;
  port?: string;
  pathname: string;
}> = [
  {
    protocol: "http",
    hostname: "localhost",
    port: "3100",
    pathname: "/api/media/file/**",
  },
  {
    protocol: "http",
    hostname: "127.0.0.1",
    port: "3100",
    pathname: "/api/media/file/**",
  },
];

if (serverUrl) {
  try {
    const parsed = new URL(serverUrl);
    const proto = parsed.protocol.replace(":", "") as "http" | "https";
    if (
      !remotePatterns.some(
        (p) => p.hostname === parsed.hostname && (p.port || "") === (parsed.port || ""),
      )
    ) {
      remotePatterns.push({
        protocol: proto,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        pathname: "/api/media/file/**",
      });
    }
  } catch {}
}

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns,
  },
  // Ensure standalone build support for memory optimization and lightweight deployment
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  // Transpile shared monorepo packages
  transpilePackages: ["@alte/shared"],
  // Trust proxy for reverse proxy environments (OpenLiteSpeed / Nginx)
  serverExternalPackages: ["pino", "pino-pretty"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/hesap/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value:
              "frame-src 'self' https://www.paytr.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paytr.com; connect-src 'self' https://www.paytr.com http://localhost:* http://127.0.0.1:* ws: wss:; form-action 'self' https://www.paytr.com;",
          },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
