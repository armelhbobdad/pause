"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface ProgressiveSkeletonProps {
  /** Whether the skeleton is active (Guardian in expanding state) */
  isActive: boolean;
  /** Optional callback when AI content is ready — skeleton respects 1.5s minimum stage display */
  onReady?: () => void;
}

// ============================================================================
// Stage Configuration
// ============================================================================

interface Stage {
  copy: string;
  startMs: number;
}

const STAGES: Stage[] = [
  { copy: "Analyzing your spending patterns...", startMs: 0 },
  { copy: "Comparing with your monthly budget...", startMs: 3000 },
  { copy: "Almost there — reviewing alternatives...", startMs: 6000 },
];

// ============================================================================
// ProgressiveSkeleton Component
// ============================================================================

export function ProgressiveSkeleton({ isActive }: ProgressiveSkeletonProps) {
  const shouldReduceMotion = useReducedMotion();
  const [currentStage, setCurrentStage] = useState(0);

  // Stage escalation timer
  useEffect(() => {
    if (!isActive) {
      setCurrentStage(0);
      return;
    }

    const timer1 = setTimeout(() => {
      setCurrentStage(1);
    }, STAGES[1].startMs);

    const timer2 = setTimeout(() => {
      setCurrentStage(2);
    }, STAGES[2].startMs);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [isActive]);

  if (!isActive) {
    return null;
  }

  const stageCopy = STAGES[currentStage].copy;

  return (
    <div
      aria-live="polite"
      data-testid="progressive-skeleton"
      role="progressbar"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
      }}
    >
      {/* Skeleton shimmer blocks */}
      <div
        data-testid="skeleton-shimmer"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        {shouldReduceMotion ? (
          <>
            <div
              data-testid="skeleton-static"
              style={{
                height: "1rem",
                width: "85%",
                borderRadius: "0.25rem",
                backgroundColor: "oklch(0.5 0 0 / 20%)",
              }}
            />
            <div
              style={{
                height: "1rem",
                width: "65%",
                borderRadius: "0.25rem",
                backgroundColor: "oklch(0.5 0 0 / 20%)",
              }}
            />
            <div
              style={{
                height: "1rem",
                width: "75%",
                borderRadius: "0.25rem",
                backgroundColor: "oklch(0.5 0 0 / 20%)",
              }}
            />
          </>
        ) : (
          <>
            <div
              style={{
                height: "1rem",
                width: "85%",
                borderRadius: "0.25rem",
                background:
                  "linear-gradient(90deg, oklch(0.5 0 0 / 10%) 25%, oklch(0.5 0 0 / 20%) 50%, oklch(0.5 0 0 / 10%) 75%)",
                backgroundSize: "400% 100%",
                animation: "shimmer 1.5s infinite linear",
              }}
            />
            <div
              style={{
                height: "1rem",
                width: "65%",
                borderRadius: "0.25rem",
                background:
                  "linear-gradient(90deg, oklch(0.5 0 0 / 10%) 25%, oklch(0.5 0 0 / 20%) 50%, oklch(0.5 0 0 / 10%) 75%)",
                backgroundSize: "400% 100%",
                animation: "shimmer 1.5s infinite linear",
                animationDelay: "200ms",
              }}
            />
            <div
              style={{
                height: "1rem",
                width: "75%",
                borderRadius: "0.25rem",
                background:
                  "linear-gradient(90deg, oklch(0.5 0 0 / 10%) 25%, oklch(0.5 0 0 / 20%) 50%, oklch(0.5 0 0 / 10%) 75%)",
                backgroundSize: "400% 100%",
                animation: "shimmer 1.5s infinite linear",
                animationDelay: "400ms",
              }}
            />
          </>
        )}
      </div>

      {/* Stage copy */}
      <p
        data-testid="skeleton-copy"
        style={{
          fontFamily: "var(--font-conversation)",
          fontSize: "0.875rem",
          color: "var(--muted-foreground, hsl(var(--muted-foreground)))",
          margin: 0,
        }}
      >
        {stageCopy}
      </p>
    </div>
  );
}
