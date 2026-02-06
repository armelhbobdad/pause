"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// Types
// ============================================================================

export interface CountdownTimerProps {
  /** Duration in milliseconds for the countdown (default: 60000ms) */
  durationMs: number;
  /** Callback when countdown reaches zero */
  onExpire?: () => void;
  /** Optional className for the container */
  className?: string;
}

// ============================================================================
// Countdown Timer Component
// ============================================================================

/**
 * CountdownTimer - Visual countdown progress bar
 *
 * Displays a thin progress bar that shrinks from 100% to 0% over the specified
 * duration. Used in CardVault to show the executive function window (60s)
 * before auto-relock.
 *
 * Design:
 * - Height: 4px thin bar
 * - Background: muted (10% opacity via color-mix)
 * - Progress: muted-foreground (30% opacity via color-mix) per UX-76
 * - No numbers, just visual countdown
 * - CSS animation for smooth 60fps performance
 *
 * @constraint UX-76: Thin progress bar, no numbers, --muted-foreground/30 opacity
 */
export function CountdownTimer({
  durationMs,
  onExpire,
  className,
}: CountdownTimerProps) {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Track mount state to prevent callback execution after unmount
  const isMountedRef = useRef(true);

  // Trigger onExpire callback when countdown completes
  useEffect(() => {
    isMountedRef.current = true;

    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        onExpireRef.current?.();
      }
    }, durationMs);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timeoutId);
    };
  }, [durationMs]);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "4px",
        overflow: "hidden",
        // Use color-mix to apply opacity to the token value (--muted-foreground is already an oklch color)
        background:
          "color-mix(in oklch, var(--muted-foreground), transparent 90%)",
        borderRadius: "0 0 1rem 1rem",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          // 30% opacity = mix with 70% transparent
          background:
            "color-mix(in oklch, var(--muted-foreground), transparent 70%)",
          animation: `countdown-shrink ${durationMs}ms linear forwards`,
          transformOrigin: "left",
        }}
      />
      {/* Keyframes injected via style tag for component portability */}
      <style>
        {`
          @keyframes countdown-shrink {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
        `}
      </style>
    </div>
  );
}
