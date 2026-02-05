import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({
  path: "../../apps/web/.env",
});

/**
 * Drizzle Kit Configuration for Neon Branch Strategy
 *
 * CONNECTION STRATEGY:
 * - Uses DATABASE_URL_DIRECT (non-pooled) for DDL operations
 * - Direct connections are required for migrations (pooler doesn't support DDL)
 * - Falls back to DATABASE_URL if DIRECT variant not set
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
    url: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || "",
  },
});
