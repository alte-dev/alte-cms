import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
};

export default withPayload(nextConfig);
