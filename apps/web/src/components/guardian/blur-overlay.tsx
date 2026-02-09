"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * BlurOverlay — Frosted glass overlay with cinematic edge-first defrost.
 *
 * Uses mask-image gradient for reveal animation (NOT backdrop-filter + clip-path,
 * per ADR-2: Safari doesn't animate clip-path on backdrop-filter elements).
 *
 * Three states:
 * - blurred: Full frosted overlay visible
 * - revealing: Animated mask-image wipe from left to right
 * - clear: Hidden (overlay removed)
 *
 * @constraint AC#3: mask-image approach, no clip-path on backdrop-filter
 * @constraint AC#5: Reduced motion → instant reveal
 * @constraint AC#7: aria-hidden, will-change: transform
 */

// ============================================================================
// Types
// ============================================================================

export type BlurOverlayState = "blurred" | "revealing" | "clear";

interface BlurOverlayProps {
  state: BlurOverlayState;
}

// ============================================================================
// Component
// ============================================================================

export function BlurOverlay({ state }: BlurOverlayProps) {
  const shouldReduceMotion = useReducedMotion();

  if (state === "clear") {
    return null;
  }

  const isRevealing = state === "revealing";
  const revealDuration = shouldReduceMotion ? 0 : 1.5;

  return (
    <motion.div
      animate={{
        opacity: isRevealing ? 0 : 1,
      }}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-2xl"
      data-testid="blur-overlay"
      initial={false}
      style={{
        backdropFilter: "blur(var(--pause-blur-heavy))",
        WebkitBackdropFilter: "blur(var(--pause-blur-heavy))",
        willChange: "transform",
        // Edge-first defrost via mask-image gradient
        maskImage: isRevealing
          ? "linear-gradient(to right, transparent 0%, black 100%)"
          : "none",
        WebkitMaskImage: isRevealing
          ? "linear-gradient(to right, transparent 0%, black 100%)"
          : "none",
        background: "var(--pause-glass)",
      }}
      transition={{
        duration: revealDuration,
        ease: "easeInOut",
      }}
    >
      {/* Fallback for browsers without backdrop-filter support */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: "var(--card-bg)",
          opacity: 0,
        }}
      />
      <style>{`
        @supports not (backdrop-filter: blur(10px)) {
          [data-testid="blur-overlay"] {
            background: var(--card-bg) !important;
            opacity: 0.85 !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
