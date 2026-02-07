"use client";

import { useEffect, useReducer, useRef } from "react";
import type { RevealType } from "@/lib/guardian/types";

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

// RevealType imported from @/lib/guardian/types (canonical definition)
export type { RevealType } from "@/lib/guardian/types";

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
  | { type: "GUARDIAN_ERROR" } // Error occurred — break glass reveal (Story 2.6)
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
  /** Type of reveal animation ("earned", "override", or "break_glass"), null if not revealed */
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
  /** Signal Guardian error — break glass reveal from expanding or active (Story 2.6) */
  guardianError: () => void;
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
 * State transition map — declarative definition of all valid transitions.
 * Maps (currentState, action) → newState or undefined (no transition).
 *
 * Transitions:
 * - idle → expanding (user taps card via REQUEST_UNLOCK)
 * - expanding → active (CSS transitionend fires via EXPANSION_COMPLETE)
 * - expanding → revealed/break_glass (GUARDIAN_ERROR, Story 2.6)
 * - active → collapsing (response received or timeout via RESPONSE_RECEIVED/TIMEOUT)
 * - active → revealed (Guardian approved via REVEAL_APPROVED)
 * - active → revealed (User override via REVEAL_OVERRIDE)
 * - active → revealed/break_glass (GUARDIAN_ERROR, Story 2.6)
 * - active → idle (wait/defer re-locks card via RELOCK, Story 5.3)
 * - collapsing → idle (animation completes via COLLAPSE_COMPLETE)
 * - revealed → idle (countdown expired or manual relock via RELOCK)
 */
const TRANSITIONS: Record<
  GuardianState,
  Partial<Record<GuardianAction["type"], GuardianInternalState>>
> = {
  idle: {
    REQUEST_UNLOCK: { status: "expanding", revealType: null },
  },
  expanding: {
    EXPANSION_COMPLETE: { status: "active", revealType: null },
    GUARDIAN_ERROR: { status: "revealed", revealType: "break_glass" },
  },
  active: {
    RESPONSE_RECEIVED: { status: "collapsing", revealType: null },
    TIMEOUT: { status: "collapsing", revealType: null },
    REVEAL_APPROVED: { status: "revealed", revealType: "earned" },
    REVEAL_OVERRIDE: { status: "revealed", revealType: "override" },
    GUARDIAN_ERROR: { status: "revealed", revealType: "break_glass" },
    RELOCK: { status: "idle", revealType: null },
  },
  collapsing: {
    COLLAPSE_COMPLETE: { status: "idle", revealType: null },
  },
  revealed: {
    RELOCK: { status: "idle", revealType: null },
  },
};

function guardianReducer(
  state: GuardianInternalState,
  action: GuardianAction
): GuardianInternalState {
  const nextState = TRANSITIONS[state.status][action.type];
  if (nextState === undefined) {
    console.warn(
      `[useGuardianState] No transition for action "${action.type}" in state "${state.status}"`
    );
    return state;
  }
  return nextState;
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

  function guardianError() {
    // Only process from expanding or active states (state guard)
    if (state !== "expanding" && state !== "active") {
      return;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    dispatch({ type: "GUARDIAN_ERROR" });
  }

  function relock() {
    // Valid from both revealed and active states (Story 5.3: wait flow dispatches from active)
    if (state !== "revealed" && state !== "active") {
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
    guardianError,
    relock,
    dispatch,
  };
}
