"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

export interface RelockTimerProps {
  /** Duration in milliseconds before auto-relock fires */
  durationMs: number;
  /** Whether the timer is currently active (only runs in revealed state) */
  isActive: boolean;
  /** Callback when timer expires — triggers RELOCK dispatch */
  onExpire: () => void;
}

// ============================================================================
// Color Interpolation Helper
// ============================================================================

/**
 * Returns an oklch color string interpolated between green, yellow, and red
 * based on the fraction of time remaining (1.0 = full, 0.0 = expired).
 */
function getTimerColor(fraction: number): string {
  if (fraction > 0.6) {
    return "var(--relock-green)";
  }
  if (fraction > 0.3) {
    return "var(--relock-yellow)";
  }
  return "var(--relock-red)";
}

// ============================================================================
// RelockTimer Component
// ============================================================================

/**
 * RelockTimer - Auto-relock progress bar for revealed card state
 *
 * Thin progress bar that depletes over the timeout period using CSS scaleX
 * transition (GPU-composited). Color shifts green -> yellow -> red as time
 * runs low. Fires onExpire when timer reaches zero.
 *
 * @constraint UX-76: Thin progress bar at card bottom
 * @constraint Story 9.4 AC#2: Color shifts green → yellow → red
 */
export function RelockTimer({
  durationMs,
  isActive,
  onExpire,
}: RelockTimerProps) {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const [color, setColor] = useState("var(--relock-green)");
  const [started, setStarted] = useState(false);
  const startTimeRef = useRef(0);

  // Start the bar animation on next frame after mount (so scaleX(1) renders first)
  useEffect(() => {
    if (!isActive) {
      setStarted(false);
      return;
    }

    startTimeRef.current = Date.now();
    // Start transition on next frame so the browser renders scaleX(1) first
    const frameId = requestAnimationFrame(() => {
      setStarted(true);
    });

    return () => cancelAnimationFrame(frameId);
  }, [isActive]);

  // Color update interval — checks every second
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const fraction = Math.max(0, 1 - elapsed / durationMs);
      setColor(getTimerColor(fraction));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isActive, durationMs]);

  // Expiry timeout
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const timeoutId = setTimeout(() => {
      onExpireRef.current();
    }, durationMs);

    return () => clearTimeout(timeoutId);
  }, [isActive, durationMs]);

  if (!isActive) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      data-testid="relock-timer"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "var(--relock-bar-height)",
        overflow: "hidden",
        borderRadius: "0 0 1rem 1rem",
      }}
    >
      <div
        data-testid="relock-timer-bar"
        style={{
          height: "100%",
          width: "100%",
          background: color,
          transform: started ? "scaleX(0)" : "scaleX(1)",
          transformOrigin: "left",
          transition: started ? `transform ${durationMs}ms linear` : "none",
          willChange: "transform",
        }}
      />
    </div>
  );
}
