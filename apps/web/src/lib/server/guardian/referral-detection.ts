import "server-only";

import { db } from "@pause/db";
import { interaction } from "@pause/db/schema";
import { desc, eq } from "drizzle-orm";

const DEFAULT_THRESHOLD = 3;
const HIGH_RISK_SCORE = 70;
const RECENT_LIMIT = 10;

interface ReferralCheckResult {
  shouldShow: boolean;
  consecutiveOverrides: number;
}

function getThreshold(): number {
  const envVal = process.env.REFERRAL_THRESHOLD;
  if (envVal) {
    const parsed = Number.parseInt(envVal, 10);
    if (!Number.isNaN(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return DEFAULT_THRESHOLD;
}

export async function checkReferralThreshold(
  userId: string
): Promise<ReferralCheckResult> {
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

  const threshold = getThreshold();

  return {
    shouldShow: consecutiveOverrides >= threshold,
    consecutiveOverrides,
  };
}
