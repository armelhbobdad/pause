"use client";

import { Clock, Coins, Sparkles } from "lucide-react";

import { EmptyState } from "./empty-state";

export function HistoryEmptyState({ onAction }: { onAction?: () => void }) {
  return (
    <EmptyState
      action={onAction ? { label: "Try it out", onClick: onAction } : undefined}
      description="No unlock requests yet. Tap your card to try it out!"
      icon={<Clock size={32} strokeWidth={1.5} />}
      title="No history yet"
    />
  );
}

export function GhostFeedEmptyState() {
  return (
    <EmptyState
      description="Your spending reflections will appear here"
      icon={<Sparkles size={32} strokeWidth={1.5} />}
      title="No reflections yet"
    />
  );
}

export function SavingsEmptyState() {
  return (
    <EmptyState
      description="Savings will accumulate as you use the Guardian"
      icon={<Coins size={32} strokeWidth={1.5} />}
      microCopy="Every spend triggers a check."
      title="$0.00 saved"
    />
  );
}
