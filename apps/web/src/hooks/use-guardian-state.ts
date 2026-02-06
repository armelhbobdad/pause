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

// ============================================================================
// Types
// ============================================================================

/**
 * Guardian UI State Machine
 * Per Architecture ADR line 445-446, extended for Story 2.3 reveal:
 * - idle: Resting state, card locked
 * - expanding: User tapped card, animation starting
 * - active: Guardian is processing (streaming and awaiting feedback)
 * - collapsing: User clicked Accept/Override, animation ending
 * - revealed: Card is unlocked, details visible (added in Story 2.3)
 */
export type GuardianState =
  | "idle"
  | "expanding"
  | "active"
  | "collapsing"
  | "revealed";

/**
 * Type of reveal animation - determines CSS animation timing
 * - earned: Guardian approved unlock (500-700ms ease-out-expo, warm snap)
 * - override: User bypassed Guardian (300-400ms linear, mechanical)
 */
export type RevealType = "earned" | "override";

/**
 * Actions that trigger state transitions
 */
export type GuardianAction =
  | { type: "REQUEST_UNLOCK" }
  | { type: "EXPANSION_COMPLETE" }
  | { type: "RESPONSE_RECEIVED" }
  | { type: "COLLAPSE_COMPLETE" }
  | { type: "TIMEOUT" }
  | { type: "REVEAL_APPROVED" } // Guardian approved unlock (Story 2.3)
  | { type: "REVEAL_OVERRIDE" } // User bypassed Guardian (Story 2.3)
  | { type: "RELOCK" }; // Countdown expired or manual relock (Story 2.3)

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
  /** Whether card details are revealed */
  isRevealed: boolean;
  /** Type of reveal animation ("earned" or "override"), null if not revealed */
  revealType: RevealType | null;
  /** Request an unlock - transitions from idle to expanding */
  requestUnlock: () => void;
  /** Signal that expansion animation completed - transitions from expanding to active */
  onExpansionComplete: () => void;
  /** Signal that response was received - transitions from active to collapsing */
  onResponseReceived: () => void;
  /** Signal that collapse animation completed - transitions from collapsing to idle */
  onCollapseComplete: () => void;
  /** Signal that Guardian approved unlock - transitions to revealed (Story 2.3) */
  revealApproved: () => void;
  /** Signal that user overrode Guardian - transitions to revealed with faster animation (Story 2.3) */
  revealOverride: () => void;
  /** Signal that countdown expired or manual relock - transitions from revealed to idle (Story 2.3) */
  relock: () => void;
  /** Dispatch any action directly (for advanced use cases) */
  dispatch: React.Dispatch<GuardianAction>;
}

// ============================================================================
// State Machine Reducer
// ============================================================================

/**
 * Internal state shape with reveal type tracking
 */
interface GuardianInternalState {
  status: GuardianState;
  revealType: RevealType | null;
}

/**
 * Guardian state machine reducer following Architecture guidelines.
 * Transitions:
 * - idle → expanding (user taps card via REQUEST_UNLOCK)
 * - expanding → active (CSS transitionend fires via EXPANSION_COMPLETE)
 * - active → collapsing (response received or timeout via RESPONSE_RECEIVED/TIMEOUT)
 * - active → revealed (Guardian approved via REVEAL_APPROVED)
 * - active → revealed (User override via REVEAL_OVERRIDE)
 * - collapsing → idle (animation completes via COLLAPSE_COMPLETE)
 * - revealed → idle (countdown expired or manual relock via RELOCK)
 */
function guardianReducer(
  state: GuardianInternalState,
  action: GuardianAction
): GuardianInternalState {
  switch (state.status) {
    case "idle":
      if (action.type === "REQUEST_UNLOCK") {
        return { status: "expanding", revealType: null };
      }
      return state;
    case "expanding":
      if (action.type === "EXPANSION_COMPLETE") {
        return { status: "active", revealType: null };
      }
      return state;
    case "active":
      if (action.type === "RESPONSE_RECEIVED") {
        return { status: "collapsing", revealType: null };
      }
      if (action.type === "TIMEOUT") {
        return { status: "collapsing", revealType: null };
      }
      if (action.type === "REVEAL_APPROVED") {
        return { status: "revealed", revealType: "earned" };
      }
      if (action.type === "REVEAL_OVERRIDE") {
        return { status: "revealed", revealType: "override" };
      }
      return state;
    case "collapsing":
      if (action.type === "COLLAPSE_COMPLETE") {
        return { status: "idle", revealType: null };
      }
      return state;
    case "revealed":
      if (action.type === "RELOCK") {
        return { status: "idle", revealType: null };
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
 * Used by the CommandCenter component to coordinate CardVault pulse,
 * expansion animations, and response handling.
 *
 * The `expanding → active` transition is driven by the parent component calling
 * `onExpansionComplete` from a CSS `transitionend` event — NOT a timer.
 *
 * @constraint FR11: 10-second timeout detection
 * @constraint Architecture: State managed via useReducer, not global state
 *
 * @example
 * ```tsx
 * const { state, isActive, requestUnlock, onExpansionComplete } = useGuardianState({
 *   onTimeout: () => console.log("Guardian timed out")
 * });
 *
 * <CardVault isActive={isActive} onUnlockRequest={requestUnlock} />
 * <GuardianConversation
 *   isActive={isActive}
 *   tier="negotiator"
 *   onExpansionComplete={onExpansionComplete}
 * >
 *   {children}
 * </GuardianConversation>
 * ```
 */
const INITIAL_STATE: GuardianInternalState = {
  status: "idle",
  revealType: null,
};

export function useGuardianState(
  options: UseGuardianStateOptions = {}
): UseGuardianStateReturn {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, onTimeout } = options;
  const [internalState, dispatch] = useReducer(guardianReducer, INITIAL_STATE);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store latest onTimeout callback in ref to avoid effect re-runs when
  // consumers pass inline functions. The ref is always current when timeout fires.
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Extract status for easier access
  const state = internalState.status;

  // Computed state helpers
  const isActive = state === "expanding" || state === "active";
  const isIdle = state === "idle";
  const isRevealed = state === "revealed";
  const revealType = internalState.revealType;

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
    if (state !== "expanding") {
      return;
    }
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
    if (state !== "collapsing") {
      return;
    }
    dispatch({ type: "COLLAPSE_COMPLETE" });
  }

  function revealApproved() {
    // Only process if in active state
    if (state !== "active") {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    dispatch({ type: "REVEAL_APPROVED" });
  }

  function revealOverride() {
    // Only process if in active state
    if (state !== "active") {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    dispatch({ type: "REVEAL_OVERRIDE" });
  }

  function relock() {
    // Only process if in revealed state
    if (state !== "revealed") {
      return;
    }
    dispatch({ type: "RELOCK" });
  }

  return {
    state,
    isActive,
    isIdle,
    isRevealed,
    revealType,
    requestUnlock,
    onExpansionComplete,
    onResponseReceived,
    onCollapseComplete,
    revealApproved,
    revealOverride,
    relock,
    dispatch,
  };
}
