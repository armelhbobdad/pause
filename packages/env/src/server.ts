import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    DATABASE_URL_DIRECT: z.string().min(1).optional(),
    // Neon Local: overrides DATABASE_URL when running local proxy
    DATABASE_URL_LOCAL: z.string().min(1).optional(),
    // Neon API key for local proxy authentication (optional, only needed for dev:db)
    NEON_API_KEY: z.string().min(1).optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
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
