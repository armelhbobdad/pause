"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { GuardianState } from "@/hooks/use-guardian-state";
import type { BlurOverlayState } from "./blur-overlay";
import { BlurOverlay } from "./blur-overlay";
import { CardFace } from "./card-face";

/**
 * CardVaultInner — Inner state animation element for the Card Vault.
 *
 * Handles all 5 guardian state animations using Framer Motion `animate` prop.
 * Separated from CardVaultWrapper per ADR-1 (Animation Layer Separation):
 * wrapper handles layout animation, inner handles state animation.
 *
 * Animation variants per state:
 * - idle: 4s breathing pulse (scale 1.0→1.02→1.0)
 * - expanding: outward ripple (box-shadow expansion, 600ms)
 * - active: pulsing amber glow (1200ms cycle)
 * - collapsing: shrink animation (scale 1.0→0.98→1.0, 400ms)
 * - revealed: cinematic defrost (1500ms on BlurOverlay)
 *
 * @constraint AC#1: breathing pulse 4s cycle using --pause-timing-breathe
 * @constraint AC#2: 5 distinct animations per state
 * @constraint AC#5: useReducedMotion accessibility
 */

// ============================================================================
// Types
// ============================================================================

interface CardVaultInnerProps {
  guardianState: GuardianState;
  layoutReady?: boolean;
}

// ============================================================================
// Animation Colors (rgba for Framer Motion interpolation — oklch is not animatable)
// Perceptual equivalents of tokens.css oklch values:
//   --guardian-pulse-start: oklch(0.85 0.02 250) → rgba(200, 210, 230, 0.6)
//   --guardian-pulse-end:   oklch(0.92 0.01 250) → rgba(218, 224, 238, 0.35)
//   --pause-active:         oklch(0.8 0.15 80)   → rgba(214, 180, 78, 0.7)
//   --pause-success:        oklch(0.6 0.2 145)   → rgba(48, 162, 76, 0.7)
// ============================================================================

const GLOW_IDLE_A = "rgba(200, 210, 230, 0.6)";
const GLOW_IDLE_B = "rgba(218, 224, 238, 0.35)";
const GLOW_ACTIVE = "rgba(214, 180, 78, 0.7)";
const GLOW_SUCCESS = "rgba(48, 162, 76, 0.7)";

// ============================================================================
// Animation Variants
// ============================================================================

function getAnimationProps(
  guardianState: GuardianState,
  reducedMotion: boolean | null
) {
  if (reducedMotion) {
    // Reduced motion: static subtle glow for idle, instant crossfade for others
    let boxShadow = "none";
    if (guardianState === "idle") {
      boxShadow = `0 0 15px 2px ${GLOW_IDLE_A}`;
    } else if (guardianState === "active") {
      boxShadow = `0 0 15px 2px ${GLOW_ACTIVE}`;
    }
    return {
      animate: {
        scale: 1,
        boxShadow,
        opacity: 1,
      },
      transition: {
        duration: 0.15,
        ease: "easeOut" as const,
      },
    };
  }

  switch (guardianState) {
    case "idle":
      return {
        animate: {
          scale: [1, 1.02, 1],
          boxShadow: [
            `0 0 10px 1px ${GLOW_IDLE_A}`,
            `0 0 20px 4px ${GLOW_IDLE_B}`,
            `0 0 10px 1px ${GLOW_IDLE_A}`,
          ],
        },
        transition: {
          duration: 4,
          ease: "easeInOut" as const,
          repeat: Number.POSITIVE_INFINITY,
        },
      };
    case "expanding":
      return {
        animate: {
          boxShadow: [
            `0 0 0px 0px ${GLOW_IDLE_A}`,
            `0 0 30px 8px ${GLOW_IDLE_B}`,
          ],
          scale: 1,
        },
        transition: {
          duration: 0.6,
          ease: "easeOut" as const,
        },
      };
    case "active":
      return {
        animate: {
          boxShadow: [
            `0 0 12px 2px ${GLOW_ACTIVE}`,
            `0 0 24px 6px ${GLOW_ACTIVE}`,
            `0 0 12px 2px ${GLOW_ACTIVE}`,
          ],
          scale: 1,
        },
        transition: {
          duration: 1.2,
          ease: "easeInOut" as const,
          repeat: Number.POSITIVE_INFINITY,
        },
      };
    case "collapsing":
      return {
        animate: {
          scale: [1, 0.98, 1],
          boxShadow: "none",
        },
        transition: {
          duration: 0.4,
          ease: "easeInOut" as const,
        },
      };
    case "revealed":
      return {
        animate: {
          scale: 1,
          boxShadow: `0 0 20px 4px ${GLOW_SUCCESS}`,
        },
        transition: {
          duration: 0.3,
          ease: "easeOut" as const,
        },
      };
    default:
      return {
        animate: { scale: 1, boxShadow: "none" },
        transition: { duration: 0.15, ease: "easeOut" as const },
      };
  }
}

// ============================================================================
// Blur Overlay State Mapping
// ============================================================================

function getBlurState(guardianState: GuardianState): BlurOverlayState {
  if (guardianState === "revealed") {
    return "revealing";
  }
  return "blurred";
}

// ============================================================================
// Component
// ============================================================================

export function CardVaultInner({
  guardianState,
  layoutReady = true,
}: CardVaultInnerProps) {
  const shouldReduceMotion = useReducedMotion();
  const { animate, transition } = getAnimationProps(
    guardianState,
    shouldReduceMotion
  );
  const blurState = getBlurState(guardianState);

  return (
    <motion.div
      animate={layoutReady ? animate : undefined}
      className="relative w-full rounded-2xl"
      data-guardian-state={guardianState}
      data-testid="card-vault-inner"
      style={{ aspectRatio: "1.586" }}
      transition={transition}
    >
      <CardFace />
      <BlurOverlay
        state={
          shouldReduceMotion && blurState === "revealing" ? "clear" : blurState
        }
      />
    </motion.div>
  );
}
