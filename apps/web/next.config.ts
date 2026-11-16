import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";
import { getSecurityHeadersConfig } from "./src/lib/security/headers";

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
  experimental: {
    globalNotFound: true,
  },
  async rewrites() {
    const medusaBackend = (process.env.MEDUSA_BACKEND_URL || "http://127.0.0.1:9000").replace(
      /\/+$/,
      "",
    );
    return [
      {
        source: "/app",
        destination: `${medusaBackend}/app`,
      },
      {
        source: "/app/:path*",
        destination: `${medusaBackend}/app/:path*`,
      },
      {
        source: "/medusa-api/admin/:path*",
        destination: `${medusaBackend}/admin/:path*`,
      },
      {
        source: "/medusa-api/auth/user/:path*",
        destination: `${medusaBackend}/auth/user/:path*`,
      },
      {
        source: "/medusa-api/auth/session",
        destination: `${medusaBackend}/auth/session`,
      },
      {
        source: "/medusa-api/auth/token/refresh",
        destination: `${medusaBackend}/auth/token/refresh`,
      },
    ];
  },
  async headers() {
    return getSecurityHeadersConfig(process.env.NODE_ENV === "production");
  },
};

export default withPayload(nextConfig);
