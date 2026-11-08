import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
