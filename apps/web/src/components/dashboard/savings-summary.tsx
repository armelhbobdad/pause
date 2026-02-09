"use client";

import { Card, CardContent } from "@/components/ui/card";

interface SavingsSummaryProps {
  totalSavedCents: number;
  interactionCount: number;
  acceptanceRate: number;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCentsToDollars(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function SavingsSummary({
  totalSavedCents,
  interactionCount,
  acceptanceRate,
}: SavingsSummaryProps) {
  const isEmpty = totalSavedCents === 0 && interactionCount === 0;

  return (
    <Card
      aria-label="Total savings"
      className="glass-card rounded-2xl p-4"
      role="region"
    >
      <CardContent className="flex flex-col gap-2 p-0">
        <span
          className="font-bold text-savings"
          data-testid="total-saved"
          style={{ fontFamily: "var(--font-data)" }}
        >
          {formatCentsToDollars(totalSavedCents)}
        </span>
        {isEmpty ? (
          <span className="text-muted-foreground text-sm">
            Every spend triggers a check.
          </span>
        ) : (
          <>
            <span className="text-base" data-testid="interaction-count">
              {interactionCount} Guardian interaction
              {interactionCount !== 1 ? "s" : ""}
            </span>
            <span
              className="text-muted-foreground text-sm"
              data-testid="acceptance-rate"
            >
              {Math.round(acceptanceRate)}% acceptance rate
            </span>
          </>
        )}
      </CardContent>
    </Card>
  );
}
