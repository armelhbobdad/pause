import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load both .env and .env.local (local takes precedence)
dotenv.config({
  path: "../../apps/web/.env",
});
dotenv.config({
  path: "../../apps/web/.env.local",
  override: true,
});

/**
 * Drizzle Kit Configuration for Neon Branch Strategy
 *
 * CONNECTION STRATEGY:
 * Priority: DATABASE_URL_LOCAL > DATABASE_URL_DIRECT > DATABASE_URL
 *
 * - DATABASE_URL_LOCAL: Neon Local proxy (localhost:5432) — uses `pg` driver
 * - DATABASE_URL_DIRECT: Non-pooled cloud connection — uses `@neondatabase/serverless`
 * - DATABASE_URL: Primary pooled connection (fallback)
 *
 * DRIVER AUTO-DETECTION:
 * Drizzle Kit auto-selects the driver based on connection string:
 * - localhost URLs → `pg` driver (standard PostgreSQL)
 * - Neon cloud URLs → `@neondatabase/serverless` (WebSocket)
 *
 * TARGETING SPECIFIC BRANCHES:
 * By default, runs against whatever branch DATABASE_URL_DIRECT points to.
 * To target a specific branch for migrations:
 *
 * 1. Update .env to point DATABASE_URL_DIRECT to the target branch
 * 2. Run: bun run db:push (applies schema to target branch)
 *
 * BRANCH ENDPOINTS (for reference):
 * - main (production): ep-polished-lake-aiehuepy
 * - preview: ep-lucky-star-aik7vam6
 * - dev: ep-purple-heart-ai7ovp7i
 *
 * SCHEMA SYNC AFTER CHANGES:
 * Child branches (preview, dev) don't auto-sync schema from main.
 * After pushing migrations to main, either:
 * - Option A: Recreate child branches from updated main (loses data)
 * - Option B: Push same migrations to each child branch (preserves data)
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Priority: LOCAL (Neon Local proxy) > DIRECT (non-pooled) > pooled
    url:
      process.env.DATABASE_URL_LOCAL ||
      process.env.DATABASE_URL_DIRECT ||
      process.env.DATABASE_URL ||
      "",
  },
});
