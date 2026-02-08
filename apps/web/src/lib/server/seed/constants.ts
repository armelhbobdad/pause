/**
 * Shared constants for demo seed scripts.
 *
 * These constants are used by both seed-rookie and seed-pro scripts
 * to ensure consistent demo data management.
 *
 * NOTE: No "server-only" import here — seed scripts run standalone via bun,
 * not as Next.js server components.
 */

/** Single demo user ID shared by both rookie and pro seeds */
export const DEMO_USER_ID = "demo-user";

/** Demo user email */
export const DEMO_USER_EMAIL = "alex@demo.pause.app";

/** Demo card ID */
export const DEMO_CARD_ID = "demo-card-4242";

/**
 * Checks that the environment is safe for running seed scripts.
 * Throws if DEMO_MODE is not enabled and --force flag is not provided.
 */
export function checkDemoSafety(): void {
  const isDemoMode = process.env.DEMO_MODE === "true";
  const isForced = process.argv.includes("--force");

  if (!(isDemoMode || isForced)) {
    throw new Error(
      "Safety check failed: seed scripts require DEMO_MODE=true or --force flag.\n" +
        "Set DEMO_MODE=true in your .env file or pass --force to override."
    );
  }
}
