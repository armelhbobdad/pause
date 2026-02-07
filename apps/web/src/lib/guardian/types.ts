/**
 * Guardian shared types
 *
 * Defines common types used across Guardian components for interaction
 * outcomes and recording. Actual persistence is deferred to Epic 3
 * (Guardian route) and Epic 6 (feedback pipeline).
 */

// ============================================================================
// Guardian Tier
// ============================================================================

/**
 * GuardianTier — determines the interaction complexity and prompt behavior.
 *
 * - analyst: Auto-approve, brief responses (Story 3.1)
 * - negotiator: Savings-focused dialogue (Epic 4)
 * - therapist: Reflection-based dialogue (Epic 5)
 */
export type GuardianTier = "analyst" | "negotiator" | "therapist";

// ============================================================================
// Reveal Type
// ============================================================================

/**
 * RevealType — determines the card reveal animation and behavior.
 *
 * - earned: Guardian approved unlock (600ms ease-out-expo, warm snap)
 * - override: User bypassed Guardian (350ms linear, mechanical)
 * - break_glass: Emergency unlock on error (350ms linear, no countdown timer)
 */
export type RevealType = "earned" | "override" | "break_glass";

// ============================================================================
// Interaction Outcome Types
// ============================================================================

/**
 * InteractionOutcome - Possible outcomes of a Guardian intervention
 *
 * Per Architecture ADR-006 and ADR-007:
 * - accepted: User followed Guardian's recommendation
 * - override: User bypassed Guardian intervention
 * - wait: User chose to wait (Therapist tier 24-hour defer)
 * - abandoned: User left without completing interaction
 *
 * @note Actual persistence happens in Epic 3/6 via POST to /api/ai/feedback
 */
export type InteractionOutcome =
  | "accepted"
  | "accepted_savings"
  | "skipped_savings"
  | "override"
  | "wait"
  | "abandoned"
  | "break_glass";

/**
 * Callback type for outcome recording
 *
 * Components accepting this callback will invoke it when an outcome
 * is determined. The callback implementation (provided by parent
 * containers in Epic 3+) handles actual persistence.
 *
 * @example
 * ```tsx
 * // In Epic 3+ container component:
 * const handleOutcome: OnOutcomeCallback = (outcome) => {
 *   postInteractionOutcome({ interactionId, outcome });
 * };
 * ```
 */
export type OnOutcomeCallback = (outcome: InteractionOutcome) => void;

// ============================================================================
// Best Offer (Negotiator Tier — Story 4.3)
// ============================================================================

/**
 * BestOffer — the top-ranked coupon/deal selected by the offer-selection algorithm.
 *
 * Used by SavingsTicket (client) for display and by server tools for selection.
 * Shared here so client components can import without pulling in server-only modules.
 */
export interface BestOffer {
  code: string;
  discount: string;
  /** Parsed numeric discount in cents. 0 when value is unknowable (e.g., percentage without price context). */
  discountCents: number;
  type: "percentage" | "fixed" | "price_match";
  source: string;
  expiresAt: string | null;
  selectionReasoning: string;
}

// ============================================================================
// Reflection Prompt Output (Therapist Tier — Story 5.1)
// ============================================================================

export interface ReflectionPromptOutput {
  strategyId: string;
  reflectionPrompt: string;
  strategyName: string;
}

// ============================================================================
// Wait Option Output (Therapist Tier — Story 5.1)
// ============================================================================

export interface WaitOptionOutput {
  durationHours: number;
  reasoning: string;
}
