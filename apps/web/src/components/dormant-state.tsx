"use client";

import { X } from "lucide-react";
import { useCallback, useState } from "react";

const DISMISS_KEY = "pause-dormant-dismissed-v1";

interface DormantStateProps {
  daysSinceLastInteraction: number;
  totalSavingsCents: number;
}

function isDismissed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const stored = localStorage.getItem(DISMISS_KEY);
  if (!stored) {
    return false;
  }
  const dismissedAt = Number(stored);
  const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSinceDismiss < 7;
}

export function DormantState({
  daysSinceLastInteraction,
  totalSavingsCents,
}: DormantStateProps) {
  const [dismissed, setDismissed] = useState(() => isDismissed());

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }, []);

  if (daysSinceLastInteraction < 7 || dismissed) {
    return null;
  }

  const savings = (totalSavingsCents / 100).toFixed(2);

  return (
    <output
      className="relative block rounded-xl border p-4"
      data-testid="dormant-state"
      style={{
        background: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <button
        aria-label="Dismiss dormant message"
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        onClick={handleDismiss}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-8 text-sm">
        Your card has been protected for {daysSinceLastInteraction} days. Total
        savings: ${savings}.
      </p>
    </output>
  );
}
