/**
 * Guardian shared types
 *
 * Defines common types used across Guardian components for interaction
 * outcomes and recording. Actual persistence is deferred to Epic 3
 * (Guardian route) and Epic 6 (feedback pipeline).
 */

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
export type InteractionOutcome = "accepted" | "override" | "wait" | "abandoned";

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
