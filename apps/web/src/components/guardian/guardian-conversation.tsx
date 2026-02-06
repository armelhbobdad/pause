"use client";

import type { ReactNode, TransitionEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { GuardianTier } from "@/lib/guardian/types";

export type { GuardianTier } from "@/lib/guardian/types";

// ============================================================================
// Types
// ============================================================================

export interface GuardianConversationProps {
  /** Whether the Guardian conversation area should be expanded */
  isActive: boolean;
  /** Guardian tier determines max-height (negotiator: 250px, therapist: 350px) */
  tier: GuardianTier;
  /** Callback when CSS expansion transition completes (fires EXPANSION_COMPLETE) */
  onExpansionComplete?: () => void;
  /** Callback when CSS collapse transition completes (fires COLLAPSE_COMPLETE) */
  onCollapseComplete?: () => void;
  /** Content to render inside the expanded area (streaming text, tool parts) */
  children?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Guardian Conversation Component
// ============================================================================

/**
 * GuardianConversation - Expanding conversation area using CSS Grid 0fr → 1fr
 *
 * Implements the two-phase expansion protocol (UX-54):
 * 1. Grid row expands 0fr → 1fr over 200ms (--ease-out-expo)
 * 2. Streaming text begins AFTER expansion completes (not during)
 *
 * The "uncovering" effect matches frost-reveal vocabulary — content is
 * revealed by the expanding grid, not pushed down.
 *
 * Inner overflow switches from `hidden` (during transition) to `auto`
 * (after expansion) per UX-55: content exceeding tier cap scrolls.
 *
 * @constraint UX-43: CSS Grid 0fr → 1fr animation
 * @constraint UX-54: Two-phase expansion protocol
 * @constraint UX-55: Tier-aware max-height with scrollable overflow
 */
export function GuardianConversation({
  isActive,
  tier,
  onExpansionComplete,
  onCollapseComplete,
  children,
  className,
}: GuardianConversationProps) {
  // Tracks whether the expansion transition has fully completed.
  // Used to switch inner overflow from hidden → auto (UX-55 scrollable content).
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);

  // Tracks whether expansion was ever initiated, preventing spurious
  // onCollapseComplete calls from transitionend events on mount.
  const hasExpandedRef = useRef(false);

  useEffect(() => {
    if (isActive) {
      hasExpandedRef.current = true;
    }
  }, [isActive]);

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    // Only fire for grid-template-rows transition, not other transitions
    if (event.propertyName === "grid-template-rows") {
      if (isActive) {
        setIsFullyExpanded(true);
        onExpansionComplete?.();
      } else {
        setIsFullyExpanded(false);
        if (hasExpandedRef.current) {
          hasExpandedRef.current = false;
          onCollapseComplete?.();
        }
      }
    }
  }

  // Inner overflow: hidden during transitions (clips content for "uncovering" effect),
  // auto after expansion completes (allows scrolling for content exceeding tier cap).
  // Uses both flags: isFullyExpanded resets on transitionend, isActive resets immediately
  // on state change — ensuring overflow: hidden as soon as collapse begins.
  const innerOverflow = isFullyExpanded && isActive ? "auto" : "hidden";

  return (
    <div
      className={className}
      data-active={isActive || undefined}
      data-tier={tier}
      onTransitionEnd={handleTransitionEnd}
      style={{
        display: "grid",
        gridTemplateRows: isActive ? "1fr" : "0fr",
        transition:
          "grid-template-rows var(--transition-expand) var(--ease-out-expo)",
        maxHeight: `var(--guardian-max-height-${tier})`,
      }}
    >
      <div style={{ overflow: innerOverflow }}>{children}</div>
    </div>
  );
}
