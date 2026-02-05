"use client";

import { useEffect, useReducer, useRef } from "react";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default timeout in milliseconds before triggering timeout action.
 * @constraint FR11: 10-second timeout detection
 */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Brief delay before auto-transitioning from expanding → active.
 * Allows animation to visually start before entering active state.
 * In Story 2.5, this will be replaced by actual animation onAnimationEnd.
 */
const EXPANSION_AUTO_TRANSITION_MS = 50;

// ============================================================================
// Types
// ============================================================================

/**
 * Guardian UI State Machine
 * Per Architecture ADR line 445-446:
 * - idle: Resting state, card locked
 * - expanding: User tapped card, animation starting
 * - active: Guardian is processing (streaming and awaiting feedback)
 * - collapsing: User clicked Accept/Override, animation ending
 */
export type GuardianState = "idle" | "expanding" | "active" | "collapsing";

/**
 * Actions that trigger state transitions
 */
export type GuardianAction =
  | { type: "REQUEST_UNLOCK" }
  | { type: "EXPANSION_COMPLETE" }
  | { type: "RESPONSE_RECEIVED" }
  | { type: "COLLAPSE_COMPLETE" }
  | { type: "TIMEOUT" };

export interface UseGuardianStateOptions {
  /** Timeout in milliseconds before triggering timeout action (default: 10000ms per FR11) */
  timeoutMs?: number;
  /** Callback when timeout occurs */
  onTimeout?: () => void;
}

export interface UseGuardianStateReturn {
  /** Current state of the Guardian */
  state: GuardianState;
  /** Whether Guardian is in active processing state (pulse animation should show) */
  isActive: boolean;
  /** Whether Guardian is idle and ready for unlock request */
  isIdle: boolean;
  /** Request an unlock - transitions from idle to expanding */
  requestUnlock: () => void;
  /** Signal that expansion animation completed - transitions from expanding to active */
  onExpansionComplete: () => void;
  /** Signal that response was received - transitions from active to collapsing */
  onResponseReceived: () => void;
  /** Signal that collapse animation completed - transitions from collapsing to idle */
  onCollapseComplete: () => void;
  /** Dispatch any action directly (for advanced use cases) */
  dispatch: React.Dispatch<GuardianAction>;
}

// ============================================================================
// State Machine Reducer
// ============================================================================

/**
 * Guardian state machine reducer following Architecture guidelines.
 * Transitions:
 * - idle → expanding (user taps card via REQUEST_UNLOCK)
 * - expanding → active (animation completes via EXPANSION_COMPLETE or auto-transition)
 * - active → collapsing (response received or timeout via RESPONSE_RECEIVED/TIMEOUT)
 * - collapsing → idle (animation completes via COLLAPSE_COMPLETE)
 */
function guardianReducer(
  state: GuardianState,
  action: GuardianAction
): GuardianState {
  switch (state) {
    case "idle":
      if (action.type === "REQUEST_UNLOCK") {
        return "expanding";
      }
      return state;
    case "expanding":
      if (action.type === "EXPANSION_COMPLETE") {
        return "active";
      }
      return state;
    case "active":
      if (action.type === "RESPONSE_RECEIVED") {
        return "collapsing";
      }
      if (action.type === "TIMEOUT") {
        return "collapsing";
      }
      return state;
    case "collapsing":
      if (action.type === "COLLAPSE_COMPLETE") {
        return "idle";
      }
      return state;
    default:
      return state;
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useGuardianState - Guardian UI State Machine Hook
 *
 * Manages the Guardian's visual state machine with automatic timeout detection.
 * Used by the Guardian container component to coordinate CardVault pulse,
 * expansion animations, and response handling.
 *
 * @constraint FR11: 10-second timeout detection
 * @constraint Architecture: State managed via useReducer, not global state
 *
 * @example
 * ```tsx
 * const { state, isActive, requestUnlock } = useGuardianState({
 *   onTimeout: () => console.log("Guardian timed out")
 * });
 *
 * <CardVault isActive={isActive} onUnlockRequest={requestUnlock} />
 * ```
 */
export function useGuardianState(
  options: UseGuardianStateOptions = {}
): UseGuardianStateReturn {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onTimeout } = options;
  const [state, dispatch] = useReducer(guardianReducer, "idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expansionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Store latest onTimeout callback in ref to avoid effect re-runs when
  // consumers pass inline functions. The ref is always current when timeout fires.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Computed state helpers
  const isActive = state === "expanding" || state === "active";
  const isIdle = state === "idle";

  // Auto-transition from expanding → active after brief delay
  // This ensures the pulse animation starts. In Story 2.5, this will be
  // replaced by actual expansion animation's onAnimationEnd callback.
  useEffect(() => {
    if (state === "expanding") {
      expansionTimeoutRef.current = setTimeout(() => {
        dispatch({ type: "EXPANSION_COMPLETE" });
      }, EXPANSION_AUTO_TRANSITION_MS);
    }

    return () => {
      if (expansionTimeoutRef.current) {
        clearTimeout(expansionTimeoutRef.current);
        expansionTimeoutRef.current = null;
      }
    };
  }, [state]);

  // Timeout detection for active state (FR11)
  useEffect(() => {
    if (state === "active") {
      timeoutRef.current = setTimeout(() => {
        dispatch({ type: "TIMEOUT" });
        onTimeoutRef.current?.();
      }, timeoutMs);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [state, timeoutMs]);

  // Action dispatchers
  function requestUnlock() {
    if (state !== "idle") {
      // Prevent duplicate requests when not in idle state
      return;
    }
    dispatch({ type: "REQUEST_UNLOCK" });
  }

  function onExpansionComplete() {
    dispatch({ type: "EXPANSION_COMPLETE" });
  }

  function onResponseReceived() {
    // Only process if in active state - prevents unnecessary dispatch
    if (state !== "active") {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    dispatch({ type: "RESPONSE_RECEIVED" });
  }

  function onCollapseComplete() {
    dispatch({ type: "COLLAPSE_COMPLETE" });
  }

  return {
    state,
    isActive,
    isIdle,
    requestUnlock,
    onExpansionComplete,
    onResponseReceived,
    onCollapseComplete,
    dispatch,
  };
}
