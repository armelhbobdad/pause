import "server-only";

import type { Skillbook } from "@pause/ace";
import type { InteractionTier } from "@/lib/server/guardian/tiers";

export interface PredictedStrategy {
  strategy_id: string;
  confidence: number;
  alternatives: Array<{ strategy_id: string; confidence: number }>;
}

/**
 * Predicts the next strategy the Guardian would select for a given tier and
 * Skillbook state. This is observational only -- it does not affect the
 * Guardian's behavior. Logged in Opik trace metadata so judges can compare
 * prediction vs actual outcome.
 *
 * Deterministic for the same Skillbook state.
 */
export function predictNextStrategy(params: {
  tier: InteractionTier;
  skillbook: Skillbook | null;
}): PredictedStrategy {
  // Analyst: always auto-approve (no learning-based strategy selection)
  if (params.tier === "analyst") {
    return { strategy_id: "auto_approve", confidence: 1.0, alternatives: [] };
  }

  // Negotiator: fixed strategy space (always searches for deals)
  if (params.tier === "negotiator") {
    return {
      strategy_id: "coupon_search",
      confidence: 0.9,
      alternatives: [{ strategy_id: "price_comparison", confidence: 0.1 }],
    };
  }

  // Therapist: Skillbook-driven
  if (!params.skillbook || params.skillbook.skills().length === 0) {
    return { strategy_id: "default", confidence: 0.5, alternatives: [] };
  }

  const activeSkills = params.skillbook.skills(false);
  const ranked = activeSkills
    .map((s) => ({
      strategy_id: s.section,
      confidence:
        (s.helpful - s.harmful) /
        Math.max(s.helpful + s.harmful + s.neutral, 1),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  const primary = ranked[0];

  return {
    strategy_id: primary.strategy_id,
    confidence: Math.max(0, Math.min(1, primary.confidence)),
    alternatives: ranked.slice(1, 4).map((a) => ({
      ...a,
      confidence: Math.max(0, Math.min(1, a.confidence)),
    })),
  };
}
