/**
 * Seeds the database with a fresh "Rookie" user state.
 *
 * Thin entry point — actual implementation in apps/web/src/lib/server/seed/rookie.ts
 *
 * @example
 * ```bash
 * bun run db:seed:rookie
 * ```
 */
// biome-ignore lint/performance/noBarrelFile: intentional re-export for CLI seed script
export { seedRookie } from "../apps/web/src/lib/server/seed/rookie";

const isMain =
  typeof import.meta !== "undefined" &&
  (import.meta as Record<string, unknown>).main;

if (isMain) {
  const { seedRookie } = await import("../apps/web/src/lib/server/seed/rookie");
  seedRookie()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed rookie failed:", error);
      process.exit(1);
    });
}
