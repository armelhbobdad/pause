"use client";

import { NativeButton } from "@/components/uitripled/native-button-shadcnui";

// ============================================================================
// Types
// ============================================================================

export interface GuardianErrorFallbackProps {
  /** Callback when user taps "Manual Unlock" to trigger break glass reveal */
  onManualUnlock?: () => void;
  /** Callback when user taps "Dismiss" to return to idle */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Guardian Error Fallback Component
// ============================================================================

/**
 * GuardianErrorFallback — presentational component for the "Guardian unavailable" state.
 * Displayed when the Guardian API returns an error or times out.
 *
 * Follows the Bodyguard frame: "Guardian unavailable. You can unlock manually."
 * Never shows raw errors, technical jargon, or panic messaging.
 *
 * @constraint AC#2: Shows supportive message with Manual Unlock button
 * @constraint NFR-R1: Break Glass fallback — user can always unlock their card
 * @constraint a11y: aria-live="assertive" announces error state to screen readers
 */
export function GuardianErrorFallback({
  onManualUnlock,
  onDismiss,
  className,
}: GuardianErrorFallbackProps) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      {/* Assertive live region for screen reader announcement (AC#2) */}
      <div aria-live="assertive">
        <p
          style={{
            fontFamily: "var(--font-conversation)",
            color: "var(--muted-foreground)",
            margin: 0,
            fontSize: "0.9rem",
            lineHeight: 1.5,
          }}
        >
          Guardian unavailable. You can unlock manually.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
        {/* Manual Unlock button — neutral styling, not destructive red (AC#2)
            Unlock is a positive action per Bodyguard frame */}
        <NativeButton onClick={onManualUnlock} size="sm" variant="outline">
          Manual Unlock
        </NativeButton>

        {onDismiss && (
          <NativeButton onClick={onDismiss} size="sm" variant="ghost">
            Dismiss
          </NativeButton>
        )}
      </div>
    </div>
  );
}
