/**
 * Re-exports seed utilities from the app source tree.
 *
 * The actual implementation lives in apps/web/src/lib/server/seed/
 * so that vitest can resolve all imports correctly.
 */

// biome-ignore lint/performance/noBarrelFile: intentional re-export module for CLI seed scripts
export { cleanDemoData } from "../apps/web/src/lib/server/seed/clean";
export {
  checkDemoSafety,
  DEMO_CARD_ID,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
} from "../apps/web/src/lib/server/seed/constants";
