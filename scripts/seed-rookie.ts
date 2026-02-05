/**
 * Seeds the database with a fresh "Rookie" user state.
 *
 * Creates:
 * - Demo user "Alex" with default profile
 * - One payment card (Stripe test card 4242 4242 4242 4242)
 * - Empty interaction history
 * - Empty Skillbook (default structure, no learned skills)
 * - No Ghost cards
 * - No savings records
 *
 * This script is used to demonstrate the initial user experience
 * where the Guardian has no prior knowledge of the user's spending habits.
 *
 * @example
 * ```bash
 * bun run db:seed:rookie
 * ```
 *
 * @returns Promise<void>
 * @throws Error if DEMO_MODE is not enabled and --force flag not provided
 */
// biome-ignore lint/suspicious/useAwait: Skeleton function - async implementation deferred to Epic 9
export async function seedRookie(): Promise<void> {
  // TODO: Implement in Epic 9 (Story 9-1)
  // Expected imports: import { db, schema } from "@pause/db";
  //
  // Implementation checklist:
  // 1. Check DEMO_MODE environment variable or --force flag
  //    - If neither, throw error to prevent accidental data modification
  //
  // 2. Clear existing demo data (use database transaction)
  //    - Delete user "Alex" if exists
  //    - Cascade delete related cards, interactions, savings, skillbook
  //
  // 3. Create demo user "Alex"
  //    - id: "demo-rookie"
  //    - name: "Alex"
  //    - email: "alex@demo.pause.app"
  //    - created_at: new Date()
  //
  // 4. Create payment card
  //    - last_four: "4242"
  //    - nickname: "Demo Card"
  //    - status: "active"
  //    - user_id: "demo-rookie"
  //    - Note: Use Stripe test card 4242 4242 4242 4242
  //
  // 5. Initialize empty Skillbook with default structure
  //    - user_id: "demo-rookie"
  //    - data: { skills: [], version: 1 }
  //    - version: 1 (for optimistic locking)
  //
  // 6. Log success message with created entity IDs

  console.log("seed-rookie: Placeholder - implement in Epic 9 (Story 9-1)");
  console.log(
    "This script will create a fresh user with no interaction history."
  );
}

// Allow running directly via bun
if (import.meta.main) {
  seedRookie()
    .then(() => {
      console.log("Seed rookie completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed rookie failed:", error);
      process.exit(1);
    });
}
