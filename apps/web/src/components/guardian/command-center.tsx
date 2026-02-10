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
import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogDescription,
  NativeDialogHeader,
  NativeDialogTitle,
} from "@/components/uitripled/native-dialog-shadcnui";
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
  /** Callback when card is revealed (interaction completed) — used to refresh stats */
  onReveal?: () => void;
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
  onTimeout,
  relockTimeoutMs = 300_000,
  onAutoRelock,
  onReveal,
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

  // Notify parent when card is revealed (interaction completed) so stats can refresh
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;
  useEffect(() => {
    if (isRevealed) {
      onRevealRef.current?.();
    }
  }, [isRevealed]);

  // --- Dialog state: Guardian interaction happens inside NativeDialog ---
  const [dialogOpen, setDialogOpen] = useState(false);

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
        setDialogOpen(false);
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
        setDialogOpen(false);
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
        setDialogOpen(false);
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
        setDialogOpen(false);
        autoApprovedRef.current = false;
        degradedRef.current = false;
        return;
      }
      autoApprovedRef.current = false;
      breakGlassRef.current = false;
      degradedRef.current = false;
      guardianError();
      setDialogOpen(false);
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
  const { isInterrupted: _isInterrupted } = useStreamTimeout({
    isStreaming,
    lastActivityTimestamp: lastActivityRef.current,
  });

  // Determine if we're in a break glass error state (Story 2.6 AC#2)
  const isBreakGlass = isRevealed && revealType === "break_glass";

  // Track whether the break glass fallback has been dismissed by the user.
  const [errorDismissed, setErrorDismissed] = useState(false);

  // Reset dismissal flag when leaving break glass state (e.g., after relock)
  useEffect(() => {
    if (!isBreakGlass) {
      setErrorDismissed(false);
    }
  }, [isBreakGlass]);

  // Close dialog when card is revealed or relocked
  useEffect(() => {
    if (isRevealed || state === "idle") {
      setDialogOpen(false);
    }
  }, [isRevealed, state]);

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

  // Handle card click: open dialog and start Guardian flow
  const handleCardActivate = () => {
    setDialogOpen(true);
    requestUnlock();
  };

  // Handle dialog close: if still active, relock
  const handleDialogOpenChange = (open: boolean) => {
    if (!open && isActive) {
      relock();
    }
    setDialogOpen(open);
  };

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateRows: "minmax(0, 2fr) minmax(0, 3fr)",
        height: "100%",
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
        <div id="tour-card-vault" style={{ position: "relative" }}>
          <CardVault
            card={card}
            countdownDuration={relockTimeoutMs}
            isActive={isActive}
            isRevealed={isRevealed}
            onCountdownExpire={() => handleAutoRelock.current()}
            onUnlockRequest={handleCardActivate}
            revealType={revealType}
            showCountdown={isRevealed}
          />
        </div>

        {/* Guardian Conversation - hidden when using dialog mode, shows for error fallback */}
        {showErrorFallback && (
          <GuardianConversation
            isActive={true}
            onCollapseComplete={onCollapseComplete}
            onExpansionComplete={onExpansionComplete}
            tier={tier}
          >
            <GuardianErrorFallback
              onDismiss={relock}
              onManualUnlock={() => setErrorDismissed(true)}
            />
          </GuardianConversation>
        )}
      </div>

      {/* Feed section (~60vh) — inert when Guardian is active (UX-90) */}
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

      {/* Guardian Dialog — glassmorphism modal for purchase interaction */}
      <NativeDialog onOpenChange={handleDialogOpenChange} open={dialogOpen}>
        <NativeDialogContent>
          <NativeDialogHeader>
            <NativeDialogTitle>
              {hasMessages ? "Guardian Review" : "What are you buying?"}
            </NativeDialogTitle>
            <NativeDialogDescription>
              {hasMessages
                ? "Your AI Guardian is reviewing this purchase."
                : "Describe your purchase and the Guardian will analyze it."}
            </NativeDialogDescription>
          </NativeDialogHeader>

          {/* Subtle divider between header and content */}
          <div
            style={{
              height: "1px",
              background:
                "linear-gradient(90deg, transparent, oklch(1 0 0 / 0.1) 20%, oklch(1 0 0 / 0.1) 80%, transparent)",
              marginBottom: "0.75rem",
            }}
          />

          {/* Purchase input form — shown when active but no messages */}
          {isActive && !hasMessages && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (purchaseInput.trim()) {
                  onExpansionComplete();
                  sendMessage({ text: purchaseInput.trim() });
                  setPurchaseInput("");
                }
              }}
              style={{ display: "flex", gap: "0.5rem" }}
            >
              <input
                aria-label="Describe your purchase"
                autoFocus
                onChange={(e) => setPurchaseInput(e.target.value)}
                placeholder="e.g. Bluetooth speaker — $79"
                style={{
                  flex: 1,
                  padding: "0.625rem 0.875rem",
                  borderRadius: "0.75rem",
                  border: "1px solid oklch(1 0 0 / 0.1)",
                  background: "oklch(0.1 0.005 250 / 60%)",
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
                  padding: "0.625rem 1.25rem",
                  borderRadius: "0.75rem",
                  background: purchaseInput.trim()
                    ? "linear-gradient(135deg, oklch(0.55 0.18 250), oklch(0.45 0.2 270))"
                    : "oklch(0.2 0.01 250)",
                  color: purchaseInput.trim()
                    ? "oklch(0.98 0 0)"
                    : "oklch(0.5 0.02 250)",
                  border: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: purchaseInput.trim() ? "pointer" : "default",
                  transition: "all 200ms ease",
                }}
                type="submit"
              >
                Send
              </button>
            </form>
          )}

          {/* Message stream — shows Guardian conversation */}
          {hasMessages && (
            <div
              style={{
                position: "relative",
                maxHeight: "50vh",
                overflow: "auto",
                padding: "0.75rem",
                borderRadius: "0.75rem",
                background: "oklch(0.08 0.005 250 / 40%)",
                border: "1px solid oklch(1 0 0 / 0.05)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, black 3%, black 92%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, black 3%, black 92%, transparent 100%)",
              }}
            >
              <MessageRenderer
                guardianContent={guardianContent}
                interactionId={interactionIdRef.current}
                isStreaming={isStreaming}
                messages={messages}
                onRevealApproved={() => {
                  revealApproved();
                  setDialogOpen(false);
                }}
                onWait={() => {
                  relock();
                  setDialogOpen(false);
                }}
              />

              {/* Streaming indicator — pulsing dots while AI is thinking */}
              {isStreaming && (
                <output
                  aria-label="Guardian is thinking"
                  style={{
                    display: "flex",
                    gap: "0.375rem",
                    padding: "0.5rem 0",
                    alignItems: "center",
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        display: "block",
                        width: "0.375rem",
                        height: "0.375rem",
                        borderRadius: "50%",
                        background: "var(--accent-glow, oklch(0.75 0.15 250))",
                        animation: `thinking-pulse 1.4s ease-in-out ${i * 0.16}s infinite`,
                      }}
                    />
                  ))}
                </output>
              )}
            </div>
          )}
        </NativeDialogContent>
      </NativeDialog>
    </div>
  );
}
