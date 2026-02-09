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
  "entertainment",
  "travel",
]);

const HISTORY_QUERY_TIMEOUT_MS = 5000;

// ============================================================================
// Purchase context parsing
// ============================================================================

const PRICE_REGEX = /\$[\s]*([\d,]+(?:\.\d{1,2})?)/;

/** Extract dollar amount from free-text purchase description. */
export function parsePriceFromText(text: string): number | undefined {
  const match = PRICE_REGEX.exec(text);
  if (!match?.[1]) {
    return undefined;
  }
  const dollars = Number.parseFloat(match[1].replace(/,/g, ""));
  if (Number.isNaN(dollars) || dollars <= 0) {
    return undefined;
  }
  return Math.round(dollars * 100);
}

// Order matters: more specific categories first to prevent false matches.
// E.g., "gaming" must precede "electronics" so "Gaming mouse" → gaming, not electronics.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  luxury: ["designer", "luxury", "gucci", "rolex", "premium", "brand"],
  gaming: [
    "gaming",
    "playstation",
    "xbox",
    "nintendo",
    "console",
    "controller",
  ],
  electronics: [
    "speaker",
    "laptop",
    "phone",
    "computer",
    "headphone",
    "earbud",
    "tablet",
    "monitor",
    "keyboard",
    "mouse",
    "iphone",
    "ipad",
    "macbook",
    "tv",
    "television",
    "camera",
    "drone",
    "airpods",
    "smartwatch",
    "charger",
    "bluetooth",
  ],
  fashion: [
    "shoes",
    "sneaker",
    "dress",
    "jacket",
    "coat",
    "shirt",
    "pants",
    "jeans",
    "handbag",
    "purse",
    "backpack",
    "boots",
    "clothing",
    "outfit",
    "hoodie",
    "sunglasses",
    "hat",
  ],
  jewelry: [
    "ring",
    "necklace",
    "bracelet",
    "earring",
    "diamond",
    "gold",
    "silver",
    "watch",
  ],
  entertainment: [
    "concert",
    "tickets",
    "festival",
    "movie",
    "show",
    "event",
    "vip",
    "theater",
  ],
  travel: [
    "vacation",
    "flight",
    "hotel",
    "booking",
    "trip",
    "airbnb",
    "cruise",
    "resort",
  ],
  subscription: ["subscription", "membership", "monthly plan", "annual plan"],
  food_delivery: ["doordash", "uber eats", "grubhub", "takeout", "delivery"],
};

/** Detect impulse category from free-text purchase description. */
export function detectCategoryFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }
  return undefined;
}

// ============================================================================
// Risk Assessment (AC#1-13, #15)
// ============================================================================

/** Score a purchase price into tiered risk factor. */
function scorePriceFactor(priceInCents: number): RiskFactor | undefined {
  const dollars = (priceInCents / 100).toFixed(2);
  if (priceInCents >= 100_000) {
    return {
      signal: "very_high_price",
      points: 75,
      description: `very high price $${dollars} (+75)`,
    };
  }
  if (priceInCents >= 20_000) {
    return {
      signal: "high_price",
      points: 60,
      description: `high price $${dollars} (+60)`,
    };
  }
  if (priceInCents >= 5000) {
    return {
      signal: "medium_price",
      points: 20,
      description: `medium price $${dollars} (+20)`,
    };
  }
  return undefined;
}

export async function assessRisk(
  input: RiskAssessmentInput
): Promise<RiskAssessmentResult> {
  const now = input.now ?? new Date();
  const factors: RiskFactor[] = [];

  // --- Resolve price and category from explicit params or text parsing ---

  const priceInCents =
    input.priceInCents ??
    (input.purchaseContext
      ? parsePriceFromText(input.purchaseContext)
      : undefined);

  const category =
    input.category ??
    (input.purchaseContext
      ? detectCategoryFromText(input.purchaseContext)
      : undefined);

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

  // Price signals (AC#3): tiered scoring based on amount
  if (priceInCents !== undefined) {
    const priceFactor = scorePriceFactor(priceInCents);
    if (priceFactor) {
      factors.push(priceFactor);
    }
  }

  // Category signal (AC#4): +10 for impulse categories
  if (category && IMPULSE_CATEGORIES.has(category.toLowerCase())) {
    factors.push({
      signal: "impulse_category",
      points: 10,
      description: `impulse category: ${category.toLowerCase()} (+10)`,
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
