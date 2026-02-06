"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface OverrideButtonProps {
  /** Callback when override button is clicked */
  onClick?: () => void;
  /** Whether the button is disabled (e.g., during processing) */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Override Button Component
// ============================================================================

/**
 * OverrideButton - User's autonomous decision button
 *
 * Per UX-05: Override button has equal visual weight to acceptance actions.
 * Uses neutral, non-judgmental styling and language.
 *
 * @constraint NFR-T5: No clinical or judgmental terminology
 * @constraint UX-05: Equal visual weight to primary action
 */
export function OverrideButton({
  onClick,
  disabled = false,
  className,
}: OverrideButtonProps) {
  return (
    <Button
      className={cn("border-muted-foreground/50", className)}
      disabled={disabled}
      onClick={onClick}
      variant="outline"
    >
      Unlock Anyway
    </Button>
  );
}
