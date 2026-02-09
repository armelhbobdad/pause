import "@pause/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.DEMO_MODE ?? "false",
  },
  typedRoutes: true,
  reactCompiler: true,
  transpilePackages: ["shiki"],
  serverExternalPackages: [
    "opik",
    "opik-vercel",
    "@vercel/otel",
    "@opentelemetry/api",
    "@opentelemetry/sdk-node",
    "@opentelemetry/auto-instrumentations-node",
    "@pause/ace",
  ],
};

export default nextConfig;
