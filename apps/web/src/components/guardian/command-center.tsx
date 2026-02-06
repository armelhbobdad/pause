"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { CardData } from "@/components/guardian/card-vault";
import { CardVault } from "@/components/guardian/card-vault";
import {
  GuardianConversation,
  type GuardianTier,
} from "@/components/guardian/guardian-conversation";
import { GuardianErrorBoundary } from "@/components/guardian/guardian-error-boundary";
import { GuardianErrorFallback } from "@/components/guardian/guardian-error-fallback";
import { useGuardianState } from "@/hooks/use-guardian-state";
import { useStreamTimeout } from "@/hooks/use-stream-timeout";

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
 * Wrapped in GuardianErrorBoundary to catch render errors (Story 2.6).
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
  return (
    <GuardianErrorBoundary>
      <CommandCenterInner
        card={card}
        className={className}
        countdownDuration={countdownDuration}
        feedContent={feedContent}
        guardianContent={guardianContent}
        onCountdownExpire={onCountdownExpire}
        onTimeout={onTimeout}
        showCountdown={showCountdown}
        tier={tier}
      />
    </GuardianErrorBoundary>
  );
}

function CommandCenterInner({
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
    relock,
  } = useGuardianState({ onTimeout });

  // Stream interruption monitoring (Story 2.6 AC#3, stub for Epic 3)
  // Hook is instantiated with dormant values (isStreaming: false) so it never fires.
  // TODO(Epic 3, Story 3.1): Wire isStreaming/lastActivityTimestamp to useChat.
  //   When isInterrupted fires: update GuardianStatus to "Connection lost.",
  //   wait 1s, call guardianError() from useGuardianState, and show
  //   toast.info("Couldn't finish checking. Card unlocked.") via sonner.
  useStreamTimeout({
    isStreaming: false,
    lastActivityTimestamp: 0,
  });

  // Determine if we're in a break glass error state (Story 2.6 AC#2)
  const isBreakGlass = isRevealed && revealType === "break_glass";

  // Track whether the break glass fallback has been dismissed by the user.
  // "Manual Unlock" acknowledges the emergency unlock (card stays revealed).
  // "Dismiss" calls relock() to return to idle.
  const [errorDismissed, setErrorDismissed] = useState(false);

  // Reset dismissal flag when leaving break glass state (e.g., after relock)
  useEffect(() => {
    if (!isBreakGlass) {
      setErrorDismissed(false);
    }
  }, [isBreakGlass]);

  // Show error fallback while in break glass AND not yet dismissed
  const showErrorFallback = isBreakGlass && !errorDismissed;

  // Content for the conversation area: show error fallback during break glass,
  // otherwise show normal guardian content.
  // GUARDIAN_ERROR auto-reveals the card (Default-to-Unlock principle per NFR-R1).
  const conversationContent = showErrorFallback ? (
    <GuardianErrorFallback
      onDismiss={relock}
      onManualUnlock={() => setErrorDismissed(true)}
    />
  ) : (
    guardianContent
  );

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

        {/* Guardian Conversation - expands below card when active or showing error fallback */}
        <GuardianConversation
          isActive={isActive || showErrorFallback}
          onCollapseComplete={onCollapseComplete}
          onExpansionComplete={onExpansionComplete}
          tier={tier}
        >
          {conversationContent}
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
