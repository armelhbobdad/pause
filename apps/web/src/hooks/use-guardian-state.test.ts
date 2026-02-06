import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGuardianState } from "./use-guardian-state";

describe("useGuardianState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // Initial State
  // ==========================================================================

  describe("initial state", () => {
    it("starts in idle state", () => {
      const { result } = renderHook(() => useGuardianState());
      expect(result.current.state).toBe("idle");
    });

    it("isIdle is true initially", () => {
      const { result } = renderHook(() => useGuardianState());
      expect(result.current.isIdle).toBe(true);
    });

    it("isActive is false initially", () => {
      const { result } = renderHook(() => useGuardianState());
      expect(result.current.isActive).toBe(false);
    });

    it("isRevealed is false initially", () => {
      const { result } = renderHook(() => useGuardianState());
      expect(result.current.isRevealed).toBe(false);
    });

    it("revealType is null initially", () => {
      const { result } = renderHook(() => useGuardianState());
      expect(result.current.revealType).toBeNull();
    });
  });

  // ==========================================================================
  // Happy Path: idle → expanding → active → collapsing → idle
  // ==========================================================================

  describe("happy path: unlock → response → collapse", () => {
    it("transitions idle → expanding on requestUnlock", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      expect(result.current.state).toBe("expanding");
      expect(result.current.isActive).toBe(true);
    });

    it("transitions expanding → active on onExpansionComplete", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      expect(result.current.state).toBe("active");
      expect(result.current.isActive).toBe(true);
    });

    it("transitions active → collapsing on onResponseReceived", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.onResponseReceived());
      expect(result.current.state).toBe("collapsing");
      expect(result.current.isActive).toBe(false);
    });

    it("transitions collapsing → idle on onCollapseComplete", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.onResponseReceived());
      act(() => result.current.onCollapseComplete());
      expect(result.current.state).toBe("idle");
      expect(result.current.isIdle).toBe(true);
    });
  });

  // ==========================================================================
  // Reveal Path: active → revealed → idle
  // ==========================================================================

  describe("reveal path: active → revealed → idle", () => {
    it("transitions active → revealed on revealApproved with earned type", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.revealApproved());
      expect(result.current.state).toBe("revealed");
      expect(result.current.isRevealed).toBe(true);
      expect(result.current.revealType).toBe("earned");
    });

    it("transitions active → revealed on revealOverride with override type", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.revealOverride());
      expect(result.current.state).toBe("revealed");
      expect(result.current.isRevealed).toBe(true);
      expect(result.current.revealType).toBe("override");
    });

    it("transitions revealed → idle on relock", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.revealApproved());
      act(() => result.current.relock());
      expect(result.current.state).toBe("idle");
      expect(result.current.revealType).toBeNull();
    });
  });

  // ==========================================================================
  // Timeout (FR11)
  // ==========================================================================

  describe("timeout detection (FR11)", () => {
    it("transitions to collapsing after default 10s timeout in active state", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      expect(result.current.state).toBe("active");

      act(() => vi.advanceTimersByTime(10_000));
      expect(result.current.state).toBe("collapsing");
    });

    it("fires onTimeout callback when timeout occurs", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() => useGuardianState({ onTimeout }));
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());

      act(() => vi.advanceTimersByTime(10_000));
      expect(onTimeout).toHaveBeenCalledOnce();
    });

    it("uses custom timeoutMs", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() =>
        useGuardianState({ timeoutMs: 5000, onTimeout })
      );
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());

      act(() => vi.advanceTimersByTime(4999));
      expect(onTimeout).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1));
      expect(onTimeout).toHaveBeenCalledOnce();
    });

    it("clears timeout when response received before timeout", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() => useGuardianState({ onTimeout }));
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());

      act(() => vi.advanceTimersByTime(5000));
      act(() => result.current.onResponseReceived());

      act(() => vi.advanceTimersByTime(10_000));
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it("clears timeout when reveal approved before timeout", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() => useGuardianState({ onTimeout }));
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());

      act(() => result.current.revealApproved());

      act(() => vi.advanceTimersByTime(10_000));
      expect(onTimeout).not.toHaveBeenCalled();
    });

    it("does not start timeout in expanding state", () => {
      const onTimeout = vi.fn();
      const { result } = renderHook(() => useGuardianState({ onTimeout }));
      act(() => result.current.requestUnlock());
      expect(result.current.state).toBe("expanding");

      act(() => vi.advanceTimersByTime(15_000));
      expect(onTimeout).not.toHaveBeenCalled();
      expect(result.current.state).toBe("expanding");
    });
  });

  // ==========================================================================
  // Guard Conditions (prevents invalid transitions)
  // ==========================================================================

  describe("guard conditions", () => {
    it("ignores requestUnlock when not idle", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      expect(result.current.state).toBe("expanding");

      // Try to requestUnlock again while expanding
      act(() => result.current.requestUnlock());
      expect(result.current.state).toBe("expanding");
    });

    it("ignores onResponseReceived when not active", () => {
      const { result } = renderHook(() => useGuardianState());
      // In idle state, onResponseReceived should be ignored
      act(() => result.current.onResponseReceived());
      expect(result.current.state).toBe("idle");
    });

    it("ignores revealApproved when not active", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.revealApproved());
      expect(result.current.state).toBe("idle");
    });

    it("ignores revealOverride when not active", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.revealOverride());
      expect(result.current.state).toBe("idle");
    });

    it("ignores relock when not revealed", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.relock());
      expect(result.current.state).toBe("idle");
    });

    it("reducer ignores invalid actions in collapsing state", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.onResponseReceived());
      expect(result.current.state).toBe("collapsing");

      // These should all be ignored
      act(() => result.current.dispatch({ type: "REQUEST_UNLOCK" }));
      expect(result.current.state).toBe("collapsing");
      act(() => result.current.dispatch({ type: "EXPANSION_COMPLETE" }));
      expect(result.current.state).toBe("collapsing");
    });

    it("reducer ignores invalid actions in revealed state", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.revealApproved());
      expect(result.current.state).toBe("revealed");

      // COLLAPSE_COMPLETE should be ignored in revealed state
      act(() => result.current.dispatch({ type: "COLLAPSE_COMPLETE" }));
      expect(result.current.state).toBe("revealed");
    });

    it("ignores onExpansionComplete when not expanding", () => {
      const { result } = renderHook(() => useGuardianState());
      // In idle state, onExpansionComplete should be ignored
      act(() => result.current.onExpansionComplete());
      expect(result.current.state).toBe("idle");
    });

    it("ignores onCollapseComplete when not collapsing", () => {
      const { result } = renderHook(() => useGuardianState());
      // In idle state, onCollapseComplete should be ignored
      act(() => result.current.onCollapseComplete());
      expect(result.current.state).toBe("idle");
    });
  });

  // ==========================================================================
  // isActive computed property
  // ==========================================================================

  describe("isActive includes both expanding and active states", () => {
    it("isActive is true in expanding state", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      expect(result.current.state).toBe("expanding");
      expect(result.current.isActive).toBe(true);
    });

    it("isActive is true in active state", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      expect(result.current.state).toBe("active");
      expect(result.current.isActive).toBe(true);
    });

    it("isActive is false in collapsing state", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.onResponseReceived());
      expect(result.current.state).toBe("collapsing");
      expect(result.current.isActive).toBe(false);
    });

    it("isActive is false in revealed state", () => {
      const { result } = renderHook(() => useGuardianState());
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.revealApproved());
      expect(result.current.state).toBe("revealed");
      expect(result.current.isActive).toBe(false);
    });
  });

  // ==========================================================================
  // Full Cycle (round-trip)
  // ==========================================================================

  describe("full cycle", () => {
    it("can complete multiple unlock cycles", () => {
      const { result } = renderHook(() => useGuardianState());

      // First cycle: unlock → response → collapse
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.onResponseReceived());
      act(() => result.current.onCollapseComplete());
      expect(result.current.state).toBe("idle");

      // Second cycle: unlock → reveal → relock
      act(() => result.current.requestUnlock());
      act(() => result.current.onExpansionComplete());
      act(() => result.current.revealOverride());
      act(() => result.current.relock());
      expect(result.current.state).toBe("idle");
    });
  });
});
