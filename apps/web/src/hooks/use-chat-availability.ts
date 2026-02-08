"use client";

import type { GuardianState } from "@/hooks/use-guardian-state";

interface ChatAvailabilityOptions {
  guardianState: GuardianState;
  isAuthenticated: boolean;
  isDemoMode: boolean;
}

interface ChatAvailabilityReturn {
  isAvailable: boolean;
  reason?: string;
}

/**
 * Determines whether the floating chat widget should be visible.
 *
 * Availability table (Story 10.6, AC#3):
 * - Unauthenticated: Yes (discovery tool on landing)
 * - Idle: Yes (primary AI access point)
 * - Waiting (24h): Yes (user may have questions) — mapped to "idle" state
 * - Demo: No (guided flow)
 * - Expanding / Active: No (Guardian demands focus)
 * - Collapsing: No (transition in progress)
 * - Reflecting / Choosing: No (critical moment) — mapped to "active"
 * - Celebrating: No (don't interrupt payoff) — mapped to "revealed"
 */
export function useChatAvailability({
  guardianState,
  isAuthenticated,
  isDemoMode,
}: ChatAvailabilityOptions): ChatAvailabilityReturn {
  if (isDemoMode) {
    return { isAvailable: false, reason: "Demo mode active" };
  }

  if (!isAuthenticated) {
    return { isAvailable: true };
  }

  switch (guardianState) {
    case "idle":
      return { isAvailable: true };
    case "expanding":
      return { isAvailable: false, reason: "Guardian is activating" };
    case "active":
      return { isAvailable: false, reason: "Guardian session in progress" };
    case "collapsing":
      return { isAvailable: false, reason: "Guardian is processing" };
    case "revealed":
      return { isAvailable: false, reason: "Viewing results" };
    default:
      return { isAvailable: true };
  }
}
