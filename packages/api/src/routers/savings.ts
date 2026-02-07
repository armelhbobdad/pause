import { db, schema } from "@pause/db";
import { and, avg, count, eq, sum } from "drizzle-orm";

import { protectedProcedure, router } from "../index";

const { interaction, savings } = schema;

export const savingsRouter = router({
  getSummary: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const appliedFilter = and(
      eq(interaction.userId, userId),
      eq(savings.applied, true)
    );

    const [aggregates] = await db
      .select({
        totalCents: sum(savings.amountCents).mapWith(Number),
        dealCount: count(savings.id),
        avgCents: avg(savings.amountCents).mapWith(Number),
      })
      .from(savings)
      .innerJoin(interaction, eq(savings.interactionId, interaction.id))
      .where(appliedFilter);

    const sourceBreakdown = await db
      .select({
        source: savings.source,
        totalCents: sum(savings.amountCents).mapWith(Number),
        count: count(savings.id),
      })
      .from(savings)
      .innerJoin(interaction, eq(savings.interactionId, interaction.id))
      .where(appliedFilter)
      .groupBy(savings.source);

    return {
      totalCents: aggregates?.totalCents ?? 0,
      dealCount: aggregates?.dealCount ?? 0,
      avgCents: Math.round(aggregates?.avgCents ?? 0),
      sourceBreakdown: sourceBreakdown.map((row) => ({
        source: row.source ?? "Unknown",
        totalCents: row.totalCents ?? 0,
        count: row.count,
      })),
    };
  }),
});
