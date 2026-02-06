"use client";

import type { ReactNode } from "react";
import type { CardData } from "@/components/guardian/card-vault";
import { CardVault } from "@/components/guardian/card-vault";
import {
  GuardianConversation,
  type GuardianTier,
} from "@/components/guardian/guardian-conversation";
import { useGuardianState } from "@/hooks/use-guardian-state";

// ============================================================================
// Types
// ============================================================================

export interface CommandCenterProps {
  /** Card data to display in the Card Vault */
  card: CardData | null;
  /** Guardian tier — determines conversation area max-height (default: negotiator) */
  tier?: GuardianTier;
  /** Content rendered inside the Guardian conversation area when active */
  guardianContent?: ReactNode;
  /** Content rendered in the feed section below the Card Vault */
  feedContent?: ReactNode;
  /** Whether to show countdown timer after reveal */
  showCountdown?: boolean;
  /** Countdown duration in ms (default: 60000) */
  countdownDuration?: number;
  /** Callback when countdown expires */
  onCountdownExpire?: () => void;
  /** Callback when Guardian times out */
  onTimeout?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Command Center Layout Component
// ============================================================================

/**
 * CommandCenter - Main layout orchestrator for the Guardian experience
 *
 * Single-screen layout with Card Vault sticky at top ~40% and feed at bottom ~60%.
 * Coordinates state machine, expansion animations, and inert attribute management.
 *
 * @constraint UX-06: Single-screen layout, Card Vault sticky top ~40%, feed bottom ~60%
 * @constraint UX-90: Feed receives `inert` when Guardian is active
 * @constraint NFR-P9: Renders correctly at 1920x1080
 */
export function CommandCenter({
  card,
  tier = "negotiator",
  guardianContent,
  feedContent,
  showCountdown = false,
  countdownDuration = 60_000,
  onCountdownExpire,
  onTimeout,
  className,
}: CommandCenterProps) {
  const {
    isActive,
    isRevealed,
    revealType,
    requestUnlock,
    onExpansionComplete,
    onCollapseComplete,
  } = useGuardianState({ onTimeout });

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateRows: "minmax(0, 2fr) minmax(0, 3fr)",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      {/* Card Vault section (~40vh) — sticky top */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: "1rem",
        }}
      >
        <CardVault
          card={card}
          countdownDuration={countdownDuration}
          isActive={isActive}
          isRevealed={isRevealed}
          onCountdownExpire={onCountdownExpire}
          onUnlockRequest={requestUnlock}
          revealType={revealType}
          showCountdown={showCountdown && isRevealed}
        />

        {/* Guardian Conversation - expands below card when active */}
        <GuardianConversation
          isActive={isActive}
          onCollapseComplete={onCollapseComplete}
          onExpansionComplete={onExpansionComplete}
          tier={tier}
        >
          {guardianContent}
        </GuardianConversation>
      </div>

      {/* Feed section (~60vh) — inert when Guardian is active (UX-90)
          Opacity dims to 0.5 during active state as visual reinforcement of
          inert status, guiding attention toward the Guardian conversation area.
          Not in UX spec — polish addition; remove if UX team objects. */}
      <section
        inert={isActive || undefined}
        style={{
          overflow: "auto",
          padding: "1rem",
          opacity: isActive ? 0.5 : 1,
          transition: "opacity 200ms ease",
        }}
      >
        {feedContent}
      </section>
    </div>
  );
}
