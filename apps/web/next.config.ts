import "@pause/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
