import { db, schema } from "@pause/db";
import { and, desc, eq, ne, sql } from "drizzle-orm";

import { protectedProcedure, router } from "../index";

const { card, interaction, savings } = schema;

const HIGH_RISK_SCORE = 70;
const RECENT_LIMIT = 10;
const DEFAULT_THRESHOLD = 3;

function getReferralThreshold(): number {
  const envVal = process.env.REFERRAL_THRESHOLD;
  if (envVal) {
    const parsed = Number.parseInt(envVal, 10);
    if (!Number.isNaN(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return DEFAULT_THRESHOLD;
}

export const dashboardRouter = router({
  // NOTE: 4 sequential queries for readability. Consider combining with CTEs
  // if dashboard LCP exceeds NFR-P5 (1.5s) target under real load.
  summary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [interactionCountResult] = await db
      .select({
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(interaction)
      .where(
        and(eq(interaction.userId, userId), ne(interaction.status, "pending"))
      );

    const [totalSavedResult] = await db
      .select({
        totalCents: sql<number>`cast(coalesce(sum(${savings.amountCents}), 0) as integer)`,
      })
      .from(savings)
      .innerJoin(interaction, eq(savings.interactionId, interaction.id))
      .where(and(eq(interaction.userId, userId), eq(savings.applied, true)));

    // Acceptance rate: only decision outcomes in denominator (Story 9.5).
    // Excludes abandoned, timeout, break_glass, wizard_bookmark, wizard_abandoned.
    // NULL propagation through round(NULL * 100) → NULL → cast NULL as float → null
    // The ?? 0 fallback at return handles the all-null-outcomes edge case safely.
    const [acceptanceRateResult] = await db
      .select({
        rate: sql<number>`cast(
          round(
            count(*) filter (where ${interaction.outcome} in ('accepted', 'wait', 'auto_approved'))::numeric
            / nullif(count(*) filter (where ${interaction.outcome} in ('accepted', 'overridden', 'wait', 'auto_approved')), 0)
            * 100, 1
          ) as float
        )`,
      })
      .from(interaction)
      .where(
        and(eq(interaction.userId, userId), ne(interaction.status, "pending"))
      );

    const recentInteractions = await db
      .select({
        id: interaction.id,
        tier: interaction.tier,
        outcome: interaction.outcome,
        reasoningSummary: interaction.reasoningSummary,
        createdAt: interaction.createdAt,
        cardLastFour: card.lastFour,
      })
      .from(interaction)
      .leftJoin(card, eq(interaction.cardId, card.id))
      .where(
        and(eq(interaction.userId, userId), ne(interaction.status, "pending"))
      )
      .orderBy(desc(interaction.createdAt))
      .limit(5);

    return {
      interactionCount: interactionCountResult?.count ?? 0,
      totalSavedCents: totalSavedResult?.totalCents ?? 0,
      acceptanceRate: acceptanceRateResult?.rate ?? 0,
      recentInteractions,
    };
  }),

  referralStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const recentInteractions = await db
      .select({
        outcome: interaction.outcome,
        riskScore: interaction.riskScore,
      })
      .from(interaction)
      .where(eq(interaction.userId, userId))
      .orderBy(desc(interaction.createdAt))
      .limit(RECENT_LIMIT);

    let consecutiveOverrides = 0;

    for (const row of recentInteractions) {
      if (
        row.outcome === "overridden" &&
        row.riskScore !== null &&
        row.riskScore >= HIGH_RISK_SCORE
      ) {
        consecutiveOverrides++;
      } else {
        break;
      }
    }

    const threshold = getReferralThreshold();

    return {
      shouldShow: consecutiveOverrides >= threshold,
      consecutiveOverrides,
    };
  }),
});
