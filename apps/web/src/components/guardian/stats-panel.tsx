"use client";

import { useCallback, useEffect, useState } from "react";

import { Sparkline } from "./sparkline";

const STORAGE_KEY = "pause-stats-pinned-v1";

interface StatsPanelProps {
  totalSavedCents: number;
  streak: number;
  pauses: number;
  goodFrictionScore: number;
  sparklineData: Array<{ amountCents: number }>;
  hidden: boolean;
  children?: React.ReactNode;
}

function readPinned(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writePinned(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* storage unavailable */
  }
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCentsToDollars(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function StatsPanel({
  totalSavedCents,
  streak,
  pauses,
  goodFrictionScore,
  sparklineData,
  hidden,
  children,
}: StatsPanelProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(readPinned());
  }, []);

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      writePinned(next);
      return next;
    });
  }, []);

  if (hidden) {
    return null;
  }

  const panelId = "stats-panel-content";

  return (
    <div
      className="rounded-2xl border p-4"
      data-testid="stats-panel"
      style={{
        background: "var(--pause-glass)",
        backdropFilter: "blur(var(--pause-blur-medium))",
        borderColor: "var(--pause-border-base)",
      }}
    >
      <button
        aria-controls={panelId}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse stats panel" : "Expand stats panel"}
        className="flex w-full items-center justify-between text-left"
        data-testid="stats-panel-toggle"
        onClick={toggle}
        type="button"
      >
        <span className="font-medium text-sm">Stats</span>
        <svg
          aria-hidden="true"
          className="h-4 w-4 transition-transform"
          data-testid="stats-panel-chevron"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
          viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div data-testid="stats-panel-content" id={panelId}>
          <div
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
            data-testid="stats-grid"
          >
            <div className="flex flex-col" data-testid="stat-total-saved">
              <span className="text-muted-foreground text-xs">Total Saved</span>
              <span
                className="font-bold text-lg"
                style={{ fontFamily: "var(--font-data)" }}
              >
                {formatCentsToDollars(totalSavedCents)}
              </span>
            </div>
            <div className="flex flex-col" data-testid="stat-streak">
              <span className="text-muted-foreground text-xs">Streak</span>
              <span
                className="font-bold text-lg"
                style={{ fontFamily: "var(--font-data)" }}
              >
                {streak}
              </span>
            </div>
            <div className="flex flex-col" data-testid="stat-pauses">
              <span className="text-muted-foreground text-xs">Pauses</span>
              <span
                className="font-bold text-lg"
                style={{ fontFamily: "var(--font-data)" }}
              >
                {pauses}
              </span>
            </div>
            <div className="flex flex-col" data-testid="stat-friction-score">
              <span className="text-muted-foreground text-xs">
                Good Friction Score
              </span>
              <span
                className="font-bold text-lg"
                style={{ fontFamily: "var(--font-data)" }}
              >
                {goodFrictionScore}%
              </span>
            </div>
          </div>

          <div className="mt-3" data-testid="sparkline-container">
            <Sparkline dataPoints={sparklineData} />
          </div>

          {children && <div className="mt-3">{children}</div>}
        </div>
      )}
    </div>
  );
}
