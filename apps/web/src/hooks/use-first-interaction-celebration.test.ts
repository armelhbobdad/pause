import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFirstInteractionCelebration } from "./use-first-interaction-celebration";

describe("useFirstInteractionCelebration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects first-interaction transition from 0 to 1+", () => {
    const { result, rerender } = renderHook(
      ({ count }) => useFirstInteractionCelebration(count),
      { initialProps: { count: 0 } }
    );

    expect(result.current).toBe(false);

    rerender({ count: 1 });
    expect(result.current).toBe(true);
  });

  it("applies celebration for 500ms then clears", () => {
    const { result, rerender } = renderHook(
      ({ count }) => useFirstInteractionCelebration(count),
      { initialProps: { count: 0 } }
    );

    rerender({ count: 1 });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toBe(false);
  });

  it("does not trigger on subsequent interactions (only first)", () => {
    const { result, rerender } = renderHook(
      ({ count }) => useFirstInteractionCelebration(count),
      { initialProps: { count: 1 } }
    );

    expect(result.current).toBe(false);

    rerender({ count: 2 });
    expect(result.current).toBe(false);

    rerender({ count: 5 });
    expect(result.current).toBe(false);
  });

  it("does not trigger when starting with interactions already present", () => {
    const { result } = renderHook(
      ({ count }) => useFirstInteractionCelebration(count),
      { initialProps: { count: 3 } }
    );

    expect(result.current).toBe(false);
  });
});
