"use client";

import { motion } from "framer-motion";
import type { KeyboardEvent } from "react";
import { useCallback, useRef } from "react";
import type { GuardianState } from "@/hooks/use-guardian-state";
import { cn } from "@/lib/utils";
import { CardVaultInner } from "./card-vault-inner";

/**
 * CardVaultWrapper — Outer layout animation shell for the Card Vault.
 *
 * Wraps CardVaultInner (which contains CardFace + BlurOverlay) with:
 * - Framer Motion layout="position" for layout transitions
 * - 50ms tap debounce to prevent double-fire
 * - isTransitioning ref to block taps during transition
 * - onLayoutAnimationComplete gates state animation start
 * - Keyboard accessibility (Enter/Space)
 * - Mobile responsive (full-width, sticky in Focused Mode)
 *
 * @constraint AC#1: layout="position" (NOT layout={true})
 * @constraint AC#6: 50ms debounce + isTransitioning ref
 * @constraint AC#7: overflow: hidden, will-change: transform
 * @constraint AC#8: Mobile full-width, sticky in Focused Mode
 * @constraint AC#9: role="button", tabIndex={0}, aria-label, Enter/Space
 */

// ============================================================================
// Constants
// ============================================================================

const DEBOUNCE_MS = 50;

// ============================================================================
// Types
// ============================================================================

interface CardVaultWrapperProps {
  guardianState: GuardianState;
  onActivate?: () => void;
  isFocusedMode?: boolean;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function CardVaultWrapper({
  guardianState,
  onActivate,
  isFocusedMode = false,
  className,
}: CardVaultWrapperProps) {
  const isTransitioningRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutReadyRef = useRef(true);

  const handleActivate = useCallback(() => {
    // Block if currently transitioning
    if (isTransitioningRef.current) {
      return;
    }

    // Block if not idle
    if (guardianState !== "idle") {
      return;
    }

    // Debounce: ignore if a timer is already pending
    if (debounceTimerRef.current !== null) {
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      isTransitioningRef.current = true;
      onActivate?.();
    }, DEBOUNCE_MS);
  }, [guardianState, onActivate]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleActivate();
      }
    },
    [handleActivate]
  );

  const handleLayoutAnimationComplete = useCallback(() => {
    isTransitioningRef.current = false;
    layoutReadyRef.current = true;
  }, []);

  return (
    <motion.div
      aria-label="Card Vault — tap to start Guardian flow"
      className={cn(
        "relative mx-auto w-full max-w-[28rem] cursor-pointer outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "max-sm:max-w-full max-sm:px-4",
        isFocusedMode && "max-sm:sticky max-sm:top-[60px] max-sm:h-[180px]",
        className
      )}
      data-testid="card-vault-wrapper"
      layout="position"
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      onLayoutAnimationComplete={handleLayoutAnimationComplete}
      role="button"
      style={{
        overflow: "hidden",
      }}
      tabIndex={0}
    >
      <CardVaultInner
        guardianState={guardianState}
        layoutReady={layoutReadyRef.current}
      />
    </motion.div>
  );
}
