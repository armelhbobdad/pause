import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_DIRECT: z.string().min(1).optional(),
    // Neon-Vercel integration: equivalent to DATABASE_URL_DIRECT (non-pooled)
    DATABASE_URL_UNPOOLED: z.string().min(1).optional(),
    // Neon Local: overrides DATABASE_URL when running local proxy
    DATABASE_URL_LOCAL: z.string().min(1).optional(),
    // Neon API key for local proxy authentication (optional, only needed for dev:db)
    NEON_API_KEY: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    // CORS_ORIGIN: explicit override, optional when VERCEL_URL is available
    CORS_ORIGIN: z.url().optional(),
    // Vercel system variables (auto-injected by Vercel)
    VERCEL_URL: z.string().optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    // Opik observability: traces Guardian interactions
    OPIK_API_KEY: z.string().min(1).optional(),
    OPIK_PROJECT_NAME: z.string().min(1).default("pause"),
    OPIK_WORKSPACE: z.string().min(1).optional(),
    // Google Generative AI: required for Gemini model
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
    // Demo mode: controls trace tagging and feature flags
    DEMO_MODE: z.enum(["true", "false"]).default("false"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.CI,
});

/**
 * Resolved database connection string with Neon Local precedence.
 * Priority: DATABASE_URL_LOCAL > DATABASE_URL
 *
 * Use this when connecting to the database to support both local proxy
 * and direct cloud connections transparently.
 */
export const databaseUrl = env.DATABASE_URL_LOCAL ?? env.DATABASE_URL;

/**
 * Resolved CORS origin with Vercel deployment support.
 * Priority: CORS_ORIGIN > VERCEL_URL > BETTER_AUTH_URL
 *
 * - CORS_ORIGIN: Explicit override (use for custom domains)
 * - VERCEL_URL: Auto-injected by Vercel (works for all deployments including previews)
 * - BETTER_AUTH_URL: Fallback for local development
 */
export const corsOrigin =
  env.CORS_ORIGIN ??
  (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : env.BETTER_AUTH_URL);
