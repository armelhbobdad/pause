import "server-only";
import { db } from "@pause/db";
import { interaction } from "@pause/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { withTimeout } from "@/lib/server/utils";

// ============================================================================
// Types (AC#14)
// ============================================================================

export interface RiskFactor {
  signal: string;
  points: number;
  description: string;
}

export interface RiskAssessmentResult {
  score: number;
  factors: RiskFactor[];
  reasoning: string;
  historyAvailable: boolean;
}

export interface RiskAssessmentInput {
  userId: string;
  cardId: string;
  /** Not yet consumed — reserved for future purchaseContext parsing. */
  purchaseContext?: string;
  priceInCents?: number;
  category?: string;
  /** Required for deterministic testing. Defaults to new Date(). */
  now?: Date;
}

// ============================================================================
// Constants
// ============================================================================

const IMPULSE_CATEGORIES = new Set([
  "electronics",
  "fashion",
  "gaming",
  "luxury",
  "jewelry",
  "food_delivery",
  "subscription",
]);

const HISTORY_QUERY_TIMEOUT_MS = 5000;

// ============================================================================
// Risk Assessment (AC#1-13, #15)
// ============================================================================

export async function assessRisk(
  input: RiskAssessmentInput
): Promise<RiskAssessmentResult> {
  const now = input.now ?? new Date();
  const factors: RiskFactor[] = [];

  // --- Context signals (always available) ---

  // Time-of-day signal (AC#2): +15 for 22:00-05:59 UTC
  const hour = now.getUTCHours();
  if (hour >= 22 || hour < 6) {
    factors.push({
      signal: "time_of_day",
      points: 15,
      description: "late-night purchase (+15)",
    });
  }

  // Price signal (AC#3): +20 for >$100 (>10000 cents)
  if (input.priceInCents !== undefined && input.priceInCents > 10_000) {
    const dollars = (input.priceInCents / 100).toFixed(2);
    factors.push({
      signal: "high_price",
      points: 20,
      description: `high price $${dollars} (+20)`,
    });
  }

  // Category signal (AC#4): +10 for impulse categories
  if (input.category && IMPULSE_CATEGORIES.has(input.category.toLowerCase())) {
    factors.push({
      signal: "impulse_category",
      points: 10,
      description: `impulse category: ${input.category.toLowerCase()} (+10)`,
    });
  }

  // --- History signals (DB query, graceful degradation) ---

  let historyAvailable = true;

  try {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentInteractions = await withTimeout(
      db
        .select({ outcome: interaction.outcome })
        .from(interaction)
        .where(
          and(
            eq(interaction.userId, input.userId),
            gte(interaction.createdAt, sevenDaysAgo)
          )
        ),
      HISTORY_QUERY_TIMEOUT_MS
    );

    // Override pattern (AC#7): +5 per override, max +25
    const overrideCount = recentInteractions.filter(
      (i) => i.outcome === "overridden"
    ).length;
    if (overrideCount > 0) {
      const overridePoints = Math.min(overrideCount * 5, 25);
      factors.push({
        signal: "recent_overrides",
        points: overridePoints,
        description: `${overrideCount} override(s) in last 7 days (+${overridePoints})`,
      });
    }

    // Accepted outcomes (AC#8): -5 per accepted, max -15
    const acceptedCount = recentInteractions.filter(
      (i) => i.outcome === "accepted"
    ).length;
    if (acceptedCount > 0) {
      const acceptedPoints = Math.max(acceptedCount * -5, -15);
      factors.push({
        signal: "accepted_outcomes",
        points: acceptedPoints,
        description: `${acceptedCount} accepted outcome(s) in last 7 days (${acceptedPoints})`,
      });
    }
  } catch {
    // AC#13: Graceful degradation — context-only scoring
    historyAvailable = false;
  }

  // --- Calculate final score (AC#5: clamp to [0, 100]) ---

  const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  // --- Build reasoning string (AC#9) ---

  const factorDescriptions = factors.map((f) => f.description).join(", ");
  const historyNote = historyAvailable
    ? ""
    : " (history unavailable — context-only scoring)";
  const reasoning =
    factors.length > 0
      ? `Risk score: ${score}/100. Factors: ${factorDescriptions}.${historyNote}`
      : `Risk score: ${score}/100. No risk factors identified.${historyNote}`;

  // TODO(future): frequency signal — +10 if 3+ unlocks in last 2 hours

  return { score, factors, reasoning, historyAvailable };
}
