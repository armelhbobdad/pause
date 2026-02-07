import { db, schema } from "@pause/db";
import { and, desc, eq, ne, sql } from "drizzle-orm";

import { protectedProcedure, router } from "../index";

const { card, interaction, savings } = schema;

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

    // Acceptance rate: NULL propagation through round(NULL * 100) → NULL → cast NULL as float → null
    // The ?? 0 fallback at return handles the all-null-outcomes edge case safely.
    const [acceptanceRateResult] = await db
      .select({
        rate: sql<number>`cast(
          round(
            count(*) filter (where ${interaction.outcome} in ('accepted', 'wait', 'auto_approved'))::numeric
            / nullif(count(*) filter (where ${interaction.outcome} is not null), 0)
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
});
