"use client";

import { useState } from "react";

import { Card, CardContent } from "@/components/ui/card";

import { SavingsEmptyState } from "./empty-states";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCentsToDollars(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

interface SourceBreakdownItem {
  source: string;
  totalCents: number;
  count: number;
}

interface SavingsBreakdownProps {
  totalCents: number;
  dealCount: number;
  avgCents: number;
  sourceBreakdown: SourceBreakdownItem[];
}

export function SavingsBreakdown({
  totalCents,
  dealCount,
  avgCents,
  sourceBreakdown,
}: SavingsBreakdownProps) {
  const [expanded, setExpanded] = useState(false);

  if (dealCount === 0) {
    return (
      <div data-testid="savings-breakdown-empty">
        <SavingsEmptyState />
      </div>
    );
  }

  return (
    <Card
      aria-label="Savings breakdown"
      className="rounded-2xl p-4"
      data-testid="savings-breakdown"
      role="region"
    >
      <CardContent className="flex flex-col gap-2 p-0">
        <button
          aria-expanded={expanded}
          className="flex w-full items-center justify-between text-left"
          data-testid="savings-breakdown-toggle"
          onClick={() => setExpanded((prev) => !prev)}
          type="button"
        >
          <span
            className="font-bold text-lg"
            data-testid="breakdown-total"
            style={{
              fontFamily: "var(--font-data)",
              color: "var(--savings-gold)",
            }}
          >
            {formatCentsToDollars(totalCents)}
          </span>
          <span className="text-muted-foreground text-sm">
            {expanded ? "Hide details" : "View details"}
          </span>
        </button>

        {expanded && (
          <div
            className="flex flex-col gap-2 pt-2"
            data-testid="breakdown-details"
          >
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deals applied</span>
              <span
                data-testid="breakdown-deal-count"
                style={{ fontFamily: "var(--font-data)" }}
              >
                {dealCount}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Average per deal</span>
              <span
                data-testid="breakdown-avg"
                style={{ fontFamily: "var(--font-data)" }}
              >
                {formatCentsToDollars(avgCents)}
              </span>
            </div>

            {sourceBreakdown.length > 0 && (
              <div className="flex flex-col gap-1 border-t pt-2">
                <span className="text-muted-foreground text-xs">By source</span>
                {sourceBreakdown.map((item) => (
                  <div
                    className="flex justify-between text-sm"
                    data-testid={`source-${item.source}`}
                    key={item.source}
                  >
                    <span>{item.source}</span>
                    <span style={{ fontFamily: "var(--font-data)" }}>
                      {formatCentsToDollars(item.totalCents)} ({item.count})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
