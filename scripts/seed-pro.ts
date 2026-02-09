/**
 * Seeds the database with an experienced "Pro" user state.
 *
 * Thin entry point — actual implementation in apps/web/src/lib/server/seed/pro.ts
 *
 * @example
 * ```bash
 * bun run db:seed:pro
 * ```
 */
// biome-ignore lint/performance/noBarrelFile: intentional re-export for CLI seed script
export { seedPro } from "../apps/web/src/lib/server/seed/pro";

const isMain =
  typeof import.meta !== "undefined" &&
  (import.meta as Record<string, unknown>).main;

if (isMain) {
  const { seedPro } = await import("../apps/web/src/lib/server/seed/pro");
  seedPro()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed pro failed:", error);
      process.exit(1);
    });
}
