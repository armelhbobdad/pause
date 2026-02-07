"use client";

import { formatRelativeTime } from "@/lib/format";

interface InteractionItem {
  id: string;
  tier: string;
  outcome: string | null;
  createdAt: string;
  savingsAmountCents: number | null;
  purchaseContext: {
    itemName?: string;
    merchant?: string;
    category?: string;
    price?: number;
  } | null;
}

interface InteractionRowProps {
  interaction: InteractionItem;
  isExpanded: boolean;
  onToggle: () => void;
}

const OUTCOME_DISPLAY = {
  accepted: { label: "Accepted", icon: "\u2713", colorVar: "--primary" },
  auto_approved: {
    label: "Auto-approved",
    icon: "\u2713",
    colorVar: "--primary",
  },
  wait: { label: "Waited", icon: "\u2713", colorVar: "--primary" },
  overridden: {
    label: "Overridden",
    icon: "\u2192",
    colorVar: "--tier-therapist",
  },
  abandoned: {
    label: "Abandoned",
    icon: "\u2014",
    colorVar: "--muted-foreground",
  },
  timeout: {
    label: "Timed out",
    icon: "\u2014",
    colorVar: "--muted-foreground",
  },
  break_glass: {
    label: "Manual unlock",
    icon: "\u2192",
    colorVar: "--tier-therapist",
  },
  wizard_bookmark: {
    label: "Bookmarked",
    icon: "\u2713",
    colorVar: "--primary",
  },
  wizard_abandoned: {
    label: "Abandoned",
    icon: "\u2014",
    colorVar: "--muted-foreground",
  },
} satisfies Record<string, { label: string; icon: string; colorVar: string }>;

const TIER_COLORS: Record<string, string> = {
  analyst: "var(--muted-foreground)",
  negotiator: "var(--savings-gold)",
  therapist: "var(--therapist-amber)",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function getOutcomeDisplay(
  outcome: string | null,
  savingsAmountCents: number | null
) {
  if (!outcome) {
    return { label: "Pending", icon: "\u2022", colorVar: "--muted-foreground" };
  }

  const display = OUTCOME_DISPLAY[outcome as keyof typeof OUTCOME_DISPLAY];
  if (!display) {
    return { label: outcome, icon: "\u2022", colorVar: "--muted-foreground" };
  }

  // Gold star for accepted with savings
  if (outcome === "accepted" && savingsAmountCents && savingsAmountCents > 0) {
    return { label: "Saved", icon: "\u2605", colorVar: "--savings-gold" };
  }

  return display;
}

export function InteractionRow({
  interaction: item,
  isExpanded,
  onToggle,
}: InteractionRowProps) {
  const tierColor = TIER_COLORS[item.tier] ?? "var(--muted-foreground)";
  const outcomeDisplay = getOutcomeDisplay(
    item.outcome,
    item.savingsAmountCents
  );
  const merchant = item.purchaseContext?.merchant;
  const category = item.purchaseContext?.category;
  let contextLabel = "";
  if (merchant && category) {
    contextLabel = `${merchant} \u00b7 ${category}`;
  } else if (merchant) {
    contextLabel = merchant;
  } else if (category) {
    contextLabel = category;
  }

  return (
    <button
      aria-expanded={isExpanded}
      aria-label={`${outcomeDisplay.label} interaction${merchant ? ` at ${merchant}` : ""}, ${item.tier} tier`}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={`interaction-row-${item.id}`}
      onClick={onToggle}
      type="button"
    >
      {/* Tier color dot */}
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        data-testid={`tier-dot-${item.id}`}
        style={{ backgroundColor: tierColor }}
      />

      {/* Outcome indicator */}
      <span
        aria-label={outcomeDisplay.label}
        className="shrink-0 text-sm"
        role="img"
        style={{ color: `var(${outcomeDisplay.colorVar})` }}
      >
        {outcomeDisplay.icon}
      </span>

      {/* Context */}
      <span className="flex flex-1 flex-col gap-0.5 truncate">
        <span className="truncate text-sm">
          {contextLabel || outcomeDisplay.label}
        </span>
      </span>

      {/* Savings badge */}
      {item.savingsAmountCents != null && item.savingsAmountCents > 0 && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-xs"
          data-testid={`savings-badge-${item.id}`}
          style={{
            backgroundColor: "var(--savings-gold-subtle)",
            color: "var(--savings-gold)",
            fontFamily: "var(--font-data)",
          }}
        >
          {currencyFormatter.format(item.savingsAmountCents / 100)}
        </span>
      )}

      {/* Relative time */}
      <span
        className="shrink-0 text-muted-foreground text-xs"
        data-testid={`time-${item.id}`}
      >
        {formatRelativeTime(new Date(item.createdAt))}
      </span>
    </button>
  );
}
