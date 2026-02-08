"use client";

import { useState } from "react";

import { formatRelativeTime } from "@/lib/format";

import { HistoryEmptyState } from "./empty-states";

interface Interaction {
  id: string;
  tier: string;
  outcome: string | null;
  reasoningSummary: string | null;
  createdAt: string | Date;
  cardLastFour: string | null;
}

interface RecentInteractionsProps {
  interactions: Interaction[];
}

const TIER_COLORS: Record<string, string> = {
  analyst: "var(--muted-foreground)",
  negotiator: "var(--savings-gold)",
  therapist: "var(--therapist-amber)",
};

export function RecentInteractions({ interactions }: RecentInteractionsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (interactions.length === 0) {
    return (
      <div data-testid="empty-interactions">
        <HistoryEmptyState />
      </div>
    );
  }

  return (
    <ul
      aria-label="Recent interactions"
      className="flex list-none flex-col gap-1"
    >
      {interactions.map((interaction) => {
        const isExpanded = expandedId === interaction.id;
        const tierColor =
          TIER_COLORS[interaction.tier] ?? "var(--muted-foreground)";

        return (
          <li key={interaction.id}>
            <button
              aria-expanded={isExpanded}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setExpandedId(isExpanded ? null : interaction.id)}
              type="button"
            >
              <span
                aria-label={`${interaction.tier} tier`}
                className="h-2 w-2 shrink-0 rounded-full"
                role="img"
                style={{ backgroundColor: tierColor }}
              />
              <span className="flex-1 truncate text-sm">
                {interaction.outcome ?? "pending"}
              </span>
              <span className="text-muted-foreground text-xs">
                {interaction.cardLastFour
                  ? `••${interaction.cardLastFour}`
                  : ""}
              </span>
              <span
                className="text-muted-foreground text-xs"
                data-testid={`time-${interaction.id}`}
              >
                {formatRelativeTime(new Date(interaction.createdAt))}
              </span>
            </button>
            {isExpanded && interaction.reasoningSummary && (
              <div
                className="px-8 pb-2 text-muted-foreground text-xs"
                data-testid={`detail-${interaction.id}`}
                style={{
                  animation:
                    "breath-beat-enter var(--transition-expand) ease-out",
                }}
              >
                {interaction.reasoningSummary}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
