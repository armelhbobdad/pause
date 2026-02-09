"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CardData } from "@/components/guardian/card-vault";
import { CardVault } from "@/components/guardian/card-vault";
import {
  GuardianConversation,
  type GuardianTier,
} from "@/components/guardian/guardian-conversation";
import { GuardianErrorBoundary } from "@/components/guardian/guardian-error-boundary";
import { GuardianErrorFallback } from "@/components/guardian/guardian-error-fallback";
import { MessageRenderer } from "@/components/guardian/message-renderer";
import { RelockTimer } from "@/components/guardian/relock-timer";
import { useGuardianState } from "@/hooks/use-guardian-state";
import { useStreamTimeout } from "@/hooks/use-stream-timeout";

// ============================================================================
// Types
// ============================================================================

export interface CommandCenterProps {
  /** Card data to display in the Card Vault */
  card: CardData | null;
  /** Card ID for Guardian API requests */
  cardId?: string;
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
  /** Auto-relock timeout in ms (default: 300000 — 5 minutes for demo) */
  relockTimeoutMs?: number;
  /** Callback when auto-relock fires — used to POST feedback with "timeout" outcome */
  onAutoRelock?: () => void;
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
  cardId,
  tier = "negotiator",
  guardianContent,
  feedContent,
  showCountdown = false,
  countdownDuration = 60_000,
  onCountdownExpire,
  onTimeout,
  relockTimeoutMs = 300_000,
  onAutoRelock,
  className,
}: CommandCenterProps) {
  return (
    <GuardianErrorBoundary>
      <CommandCenterInner
        card={card}
        cardId={cardId}
        className={className}
        countdownDuration={countdownDuration}
        feedContent={feedContent}
        guardianContent={guardianContent}
        onAutoRelock={onAutoRelock}
        onCountdownExpire={onCountdownExpire}
        onTimeout={onTimeout}
        relockTimeoutMs={relockTimeoutMs}
        showCountdown={showCountdown}
        tier={tier}
      />
    </GuardianErrorBoundary>
  );
}

function CommandCenterInner({
  card,
  cardId,
  tier = "negotiator",
  guardianContent,
  feedContent,
  showCountdown = false,
  countdownDuration = 60_000,
  onCountdownExpire,
  onTimeout,
  relockTimeoutMs = 300_000,
  onAutoRelock,
  className,
}: CommandCenterProps) {
  const {
    state,
    isActive,
    isRevealed,
    revealType,
    requestUnlock,
    onExpansionComplete,
    onCollapseComplete,
    revealApproved,
    guardianError,
    relock,
  } = useGuardianState({ onTimeout, timeoutMs: 120_000 });

  // --- Auto-approve detection (Story 3.5) ---
  // SDK v6 doesn't expose response headers via onFinish. We intercept them
  // using a custom fetch wrapper on the transport, then dispatch the reveal
  // action in the onFinish callback after the stream completes.
  const autoApprovedRef = useRef(false);
  const breakGlassRef = useRef(false);
  const degradedRef = useRef(false);
  const interactionIdRef = useRef<string | null>(null);

  // --- useChat integration (Story 3.1, AC#18) ---
  // React Compiler memoizes the transport instance based on cardId stability.
  // If cardId is undefined, body omits it and server returns 400 → onError → break glass.
  const [purchaseInput, setPurchaseInput] = useState("");
  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/guardian",
      body: cardId ? { cardId } : undefined,
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        autoApprovedRef.current =
          response.headers.get("x-guardian-auto-approved") === "true";
        breakGlassRef.current =
          response.headers.get("x-guardian-break-glass") === "true";
        degradedRef.current =
          response.headers.get("x-guardian-degraded") === "true";
        interactionIdRef.current = response.headers.get("x-interaction-id");
        return response;
      },
    }),
    onFinish: () => {
      if (breakGlassRef.current) {
        guardianError();
        toast.warning("Guardian unavailable. Manual unlock enabled.", {
          duration: 4000,
        });
        breakGlassRef.current = false;
        return;
      }
      if (autoApprovedRef.current) {
        if (degradedRef.current) {
          toast.info("Quick approval — Guardian running in lite mode", {
            duration: 3000,
          });
        } else {
          toast.success("Auto-approved", { duration: 2000 });
        }
        revealApproved();
        autoApprovedRef.current = false;
        degradedRef.current = false;
        return;
      }
    },
    onError: () => {
      // Degraded responses (non-streaming) may trigger onError instead of onFinish.
      // Check refs set by the fetch wrapper before falling through to generic error.
      if (breakGlassRef.current) {
        guardianError();
        toast.warning("Guardian unavailable. Manual unlock enabled.", {
          duration: 4000,
        });
        autoApprovedRef.current = false;
        breakGlassRef.current = false;
        degradedRef.current = false;
        return;
      }
      if (autoApprovedRef.current) {
        if (degradedRef.current) {
          toast.info("Quick approval — Guardian running in lite mode", {
            duration: 3000,
          });
        } else {
          toast.success("Auto-approved", { duration: 2000 });
        }
        revealApproved();
        autoApprovedRef.current = false;
        degradedRef.current = false;
        return;
      }
      autoApprovedRef.current = false;
      breakGlassRef.current = false;
      degradedRef.current = false;
      guardianError();
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Track last streaming activity for timeout detection.
  // Updated when messages array changes while streaming is active.
  const lastActivityRef = useRef(0);
  if (isStreaming) {
    lastActivityRef.current = Date.now();
  }

  // Stream interruption monitoring (Story 2.6 AC#3, wired to useChat).
  // NOTE: isInterrupted is tracked for UI feedback (e.g., "Connection lost" indicator)
  // but does NOT trigger break-glass directly. Break-glass is handled exclusively by
  // the onError callback. This avoids a race condition where the 3s stream timeout
  // fires during initial API response latency, before onFinish/onError can run.
  const { isInterrupted: _isInterrupted } = useStreamTimeout({
    isStreaming,
    lastActivityTimestamp: lastActivityRef.current,
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

  // Abandoned tracking: send beacon on beforeunload when active (Story 9.5)
  useEffect(() => {
    if (state !== "active") {
      return;
    }
    const handler = () => {
      if (interactionIdRef.current) {
        navigator.sendBeacon(
          "/api/ai/feedback",
          new Blob(
            [
              JSON.stringify({
                interactionId: interactionIdRef.current,
                outcome: "abandoned",
              }),
            ],
            { type: "application/json" }
          )
        );
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

  // Auto-relock handler: relock + toast + callback (Story 9.4)
  const handleAutoRelock = useRef(() => {
    relock();
    toast.info("Card re-locked for your protection", { duration: 3000 });
    onAutoRelock?.();
  });
  handleAutoRelock.current = () => {
    relock();
    toast.info("Card re-locked for your protection", { duration: 3000 });
    onAutoRelock?.();
  };

  // Show error fallback while in break glass AND not yet dismissed
  const showErrorFallback = isBreakGlass && !errorDismissed;

  // Whether the user has submitted their purchase description
  const hasMessages = messages.length > 0;

  // Purchase input form — shown when Guardian is active but no message sent yet
  const purchaseInputForm =
    isActive && !hasMessages ? (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (purchaseInput.trim()) {
            sendMessage({ text: purchaseInput.trim() });
            setPurchaseInput("");
          }
        }}
        style={{
          display: "flex",
          gap: "0.5rem",
          padding: "0.75rem",
        }}
      >
        <input
          aria-label="Describe your purchase"
          autoFocus
          onChange={(e) => setPurchaseInput(e.target.value)}
          placeholder="What are you buying? e.g. Bluetooth speaker - $79"
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--card-border)",
            background: "var(--card-bg, hsl(var(--muted)))",
            color: "inherit",
            fontSize: "0.875rem",
            fontFamily: "var(--font-conversation)",
            outline: "none",
          }}
          value={purchaseInput}
        />
        <button
          disabled={!purchaseInput.trim()}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            background: purchaseInput.trim()
              ? "hsl(var(--primary))"
              : "hsl(var(--muted))",
            color: purchaseInput.trim()
              ? "hsl(var(--primary-foreground))"
              : "hsl(var(--muted-foreground))",
            border: "none",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: purchaseInput.trim() ? "pointer" : "default",
          }}
          type="submit"
        >
          Send
        </button>
      </form>
    ) : null;

  // Content for the conversation area: show error fallback during break glass,
  // otherwise delegate to MessageRenderer for text + tool parts (Story 4.4).
  // GUARDIAN_ERROR auto-reveals the card (Default-to-Unlock principle per NFR-R1).
  const conversationContent = showErrorFallback ? (
    <GuardianErrorFallback
      onDismiss={relock}
      onManualUnlock={() => setErrorDismissed(true)}
    />
  ) : (
    <>
      {purchaseInputForm}
      <MessageRenderer
        guardianContent={guardianContent}
        interactionId={interactionIdRef.current}
        isStreaming={isStreaming}
        messages={messages}
        onRevealApproved={revealApproved}
        onWait={relock}
      />
    </>
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
        <div style={{ position: "relative" }}>
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

          {/* Auto-relock timer — only in revealed state, not break glass (Story 9.4) */}
          <RelockTimer
            durationMs={relockTimeoutMs}
            isActive={isRevealed && revealType !== "break_glass"}
            onExpire={() => handleAutoRelock.current()}
          />
        </div>

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
