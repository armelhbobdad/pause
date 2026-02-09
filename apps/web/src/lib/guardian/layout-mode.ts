import type { GuardianState } from "@/hooks/use-guardian-state";

/**
 * Derive layout mode from Guardian state (ADR-4).
 *
 * Pure function -- no separate state variable.
 * idle -> minimal (calm, informative dashboard)
 * expanding | active | collapsing | revealed -> focused (distraction-free)
 */
export function getLayoutMode(
  guardianState: GuardianState
): "minimal" | "focused" {
  if (guardianState === "idle") {
    return "minimal";
  }
  return "focused";
}
