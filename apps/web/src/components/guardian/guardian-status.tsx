"use client";

import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type GuardianStatusState =
  | "idle"
  | "analyzing"
  | "streaming"
  | "complete";

export interface GuardianStatusProps {
  /** Current status of the Guardian */
  status: GuardianStatusState;
  /** Optional custom text to display (overrides default text for status) */
  text?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Status Text Mapping
// ============================================================================

const STATUS_TEXT: Record<GuardianStatusState, string> = {
  idle: "",
  analyzing: "Guardian analyzing...",
  streaming: "Guardian responding...",
  complete: "Analysis complete",
};

// ============================================================================
// Guardian Status Component
// ============================================================================

/**
 * GuardianStatus displays status text during Guardian processing.
 * Positioned below Card Vault (inside expansion area per Story 2.5).
 *
 * @design-token --font-conversation: Geist Sans for conversational text
 * @constraint FR9: Status text updates to "Guardian analyzing..."
 * @constraint UX: Continuous Density pattern - no silence >800ms
 */
export function GuardianStatus({
  status,
  text,
  className,
}: GuardianStatusProps) {
  const displayText = text ?? STATUS_TEXT[status];

  // Always render container to prevent layout shift when status changes
  // Idle state renders empty but maintains height for smooth transitions
  return (
    <div
      aria-live="polite"
      className={cn(
        "min-h-5 text-center text-muted-foreground text-sm transition-opacity",
        status === "idle" && "opacity-0",
        status === "complete" && "opacity-70",
        className
      )}
      style={{ fontFamily: "var(--font-conversation)" }}
    >
      {status !== "idle" && displayText}
    </div>
  );
}
