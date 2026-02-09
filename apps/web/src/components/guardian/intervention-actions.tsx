"use client";

import { OverrideButton } from "@/components/guardian/override-button";
import { NativeButton } from "@/components/uitripled/native-button-shadcnui";
import type { InteractionOutcome } from "@/lib/guardian/types";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface InterventionActionsProps {
  /** Callback when user accepts Guardian's recommendation */
  onAccept?: () => void;
  /** Callback when user overrides Guardian intervention */
  onOverride?: () => void;
  /** Callback when any outcome is selected (for recording) */
  onOutcome?: (outcome: InteractionOutcome) => void;
  /** Whether an action is currently being processed */
  isProcessing?: boolean;
  /** Label for the accept/primary action button */
  acceptLabel?: string;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Intervention Actions Component
// ============================================================================

/**
 * InterventionActions - Two-button layout for Guardian intervention responses
 *
 * Per critical-flow-design.md Two-Choice Cognitive Model:
 * - Primary Button (left): Guardian's Advice - executes Guardian's recommendation
 * - Secondary Button (right): User's Will - always "Unlock Anyway"
 *
 * Both buttons have equal visual weight per UX-05.
 *
 * **Integration Pattern:** This component accepts callbacks for flexibility.
 * Parent components should wire `onOverride` to call `revealOverride()` from
 * the `useGuardianState` hook to trigger the reveal animation:
 *
 * ```tsx
 * const { revealOverride } = useGuardianState();
 * <InterventionActions onOverride={revealOverride} />
 * ```
 *
 * **Design Notes:**
 * - `acceptLabel` is customizable (varies by tier: "Wait 24 Hours", "Apply & Unlock")
 * - Override label is intentionally fixed as "Unlock Anyway" per NFR-T5 (non-judgmental)
 * - Loading spinner appears on Accept button (the action typically involving processing)
 *
 * @constraint UX-05: Equal visual weight for both actions
 * @constraint NFR-T5: No judgmental terminology
 */
export function InterventionActions({
  onAccept,
  onOverride,
  onOutcome,
  isProcessing = false,
  acceptLabel = "Accept",
  className,
}: InterventionActionsProps) {
  function handleAccept() {
    onAccept?.();
    onOutcome?.("accepted");
  }

  function handleOverride() {
    onOverride?.();
    onOutcome?.("override");
  }

  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      {/* Primary action: Guardian's recommendation (left) */}
      <NativeButton
        className="min-w-[120px]"
        disabled={isProcessing}
        loading={isProcessing}
        onClick={handleAccept}
        variant="default"
      >
        {acceptLabel}
      </NativeButton>

      {/* Secondary action: User's autonomous decision (right) */}
      <OverrideButton
        className="min-w-[120px]"
        disabled={isProcessing}
        onClick={handleOverride}
      />
    </div>
  );
}
