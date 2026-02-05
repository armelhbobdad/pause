/**
 * Seeds the database with an experienced "Pro" user state.
 *
 * Creates:
 * - Demo user "Alex" with established profile
 * - Payment card with unlock history
 * - 5+ past interactions across all Guardian tiers (Analyst, Negotiator, Therapist)
 * - Trained Skillbook with strategy effectiveness scores
 * - 1 pre-planted Ghost card awaiting feedback (per UX-16)
 * - Cumulative savings of ~$50
 * - Mock coupon guaranteed for "electronics" category (DEMO15)
 *
 * This script is used to demonstrate the full Guardian experience
 * where the AI has learned from previous interactions and can provide
 * personalized, context-aware guidance.
 *
 * @example
 * ```bash
 * bun run db:seed:pro
 * ```
 *
 * @returns Promise<void>
 * @throws Error if DEMO_MODE is not enabled and --force flag not provided
 */
// biome-ignore lint/suspicious/useAwait: Skeleton function - async implementation deferred to Epic 9
export async function seedPro(): Promise<void> {
  // TODO: Implement in Epic 9 (Story 9-2)
  // Expected imports: import { db, schema } from "@pause/db";
  //
  // Implementation checklist:
  // 1. Check DEMO_MODE environment variable or --force flag
  //    - If neither, throw error to prevent accidental data modification
  //
  // 2. Clear existing demo data (use database transaction)
  //    - Delete user "Alex" if exists
  //    - Cascade delete related cards, interactions, savings, skillbook, ghost cards
  //
  // 3. Create demo user "Alex"
  //    - id: "demo-pro"
  //    - name: "Alex"
  //    - email: "alex@demo.pause.app"
  //    - created_at: 30 days ago (established user)
  //
  // 4. Create payment card with unlock history
  //    - last_four: "4242"
  //    - nickname: "Demo Card"
  //    - status: "active"
  //    - user_id: "demo-pro"
  //    - Include multiple lock/unlock events in history
  //
  // 5. Create 5+ past interactions across all tiers
  //    - At least 1 Analyst tier interaction (low-risk auto-approve)
  //    - At least 2 Negotiator tier interactions (savings found)
  //    - At least 2 Therapist tier interactions (reflection prompts)
  //    - Mix of completed and feedback_received statuses
  //
  // 6. Create trained Skillbook with strategy effectiveness scores
  //    - user_id: "demo-pro"
  //    - data: { skills: [...learned strategies], version: 5 }
  //    - Include skills with helpful/harmful/neutral counts
  //    - Example skills:
  //      - "24-hour delay increases purchase reconsideration"
  //      - "Electronics purchases benefit from coupon search"
  //      - "User responds well to savings-focused framing"
  //
  // 7. Create 1 Ghost card awaiting feedback (UX-16)
  //    - Linked to a completed interaction from 3 days ago
  //    - Status: "awaiting_feedback"
  //    - Question: "How do you feel about that purchase now?"
  //
  // 8. Create savings records totaling ~$50
  //    - Multiple records across different interactions
  //    - Example: $15 from coupon, $20 from price match, $18 from waiting
  //
  // 9. Seed mock coupon for demo reliability
  //    - Code: "DEMO15"
  //    - Category: "electronics"
  //    - Discount: 15%
  //    - Always available in DEMO_MODE
  //
  // 10. Log success message with created entity counts

  console.log("seed-pro: Placeholder - implement in Epic 9 (Story 9-2)");
  console.log(
    "This script will create an experienced user with trained Guardian."
  );
}

// Allow running directly via bun
if (import.meta.main) {
  seedPro()
    .then(() => {
      console.log("Seed pro completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed pro failed:", error);
      process.exit(1);
    });
}
