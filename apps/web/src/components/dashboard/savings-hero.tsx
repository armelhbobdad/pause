"use client";

import { SavingsBreakdown } from "./savings-breakdown";
import { SavingsCounter } from "./savings-counter";

interface SourceBreakdownItem {
  source: string;
  totalCents: number;
  count: number;
}

interface SavingsHeroProps {
  totalSavedCents: number;
  interactionCount: number;
  acceptanceRate: number;
  savingsDetail?: {
    totalCents: number;
    dealCount: number;
    avgCents: number;
    sourceBreakdown: SourceBreakdownItem[];
  };
}

export function SavingsHero({
  totalSavedCents,
  interactionCount,
  acceptanceRate,
  savingsDetail,
}: SavingsHeroProps) {
  const isEmpty = totalSavedCents === 0 && interactionCount === 0;

  return (
    <section
      aria-label="Total savings"
      className="glass-card-elevated flex flex-col gap-3 rounded-2xl p-4"
      data-testid="savings-hero"
    >
      <SavingsCounter totalCents={totalSavedCents} />

      {isEmpty ? (
        <span className="text-muted-foreground text-sm">
          Every spend triggers a check.
        </span>
      ) : (
        <span className="text-muted-foreground text-sm">
          <span data-testid="interaction-count">
            {interactionCount} Guardian interaction
            {interactionCount !== 1 ? "s" : ""}
          </span>
          {" · "}
          <span data-testid="acceptance-rate">
            {Math.round(acceptanceRate)}% acceptance
          </span>
        </span>
      )}

      {savingsDetail && (
        <SavingsBreakdown
          avgCents={savingsDetail.avgCents}
          dealCount={savingsDetail.dealCount}
          sourceBreakdown={savingsDetail.sourceBreakdown}
          totalCents={savingsDetail.totalCents}
        />
      )}
    </section>
  );
}
