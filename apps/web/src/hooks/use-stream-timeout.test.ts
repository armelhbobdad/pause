import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStreamTimeout } from "./use-stream-timeout";

describe("useStreamTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns isInterrupted: false when streaming is active", () => {
    const { result } = renderHook(() =>
      useStreamTimeout({
        isStreaming: true,
        lastActivityTimestamp: Date.now(),
      })
    );
    expect(result.current.isInterrupted).toBe(false);
  });

  it("returns isInterrupted: true after timeout with no activity", () => {
    const now = Date.now();
    const { result } = renderHook(() =>
      useStreamTimeout({
        isStreaming: true,
        lastActivityTimestamp: now,
      })
    );

    expect(result.current.isInterrupted).toBe(false);
    act(() => {
      vi.advanceTimersByTime(3001);
    });
    expect(result.current.isInterrupted).toBe(true);
  });

  it("resets when new activity occurs", () => {
    let timestamp = Date.now();
    const { result, rerender } = renderHook(
      ({ ts }) =>
        useStreamTimeout({
          isStreaming: true,
          lastActivityTimestamp: ts,
        }),
      { initialProps: { ts: timestamp } }
    );

    // Advance near timeout
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.isInterrupted).toBe(false);

    // New activity resets the timer
    timestamp = Date.now() + 2500;
    rerender({ ts: timestamp });

    // Advance another 2500ms — should still not be interrupted (timer reset)
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.isInterrupted).toBe(false);

    // But 500ms more (total 3000ms from last activity) triggers interruption
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.isInterrupted).toBe(true);
  });

  it("respects custom timeout duration", () => {
    const now = Date.now();
    const { result } = renderHook(() =>
      useStreamTimeout({
        isStreaming: true,
        lastActivityTimestamp: now,
        timeoutMs: 5000,
      })
    );

    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current.isInterrupted).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.isInterrupted).toBe(true);
  });

  it("does not trigger timeout when not streaming", () => {
    const { result } = renderHook(() =>
      useStreamTimeout({
        isStreaming: false,
        lastActivityTimestamp: Date.now(),
      })
    );

    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.isInterrupted).toBe(false);
  });

  it("returns null partialContent by default", () => {
    const { result } = renderHook(() =>
      useStreamTimeout({
        isStreaming: true,
        lastActivityTimestamp: Date.now(),
      })
    );
    expect(result.current.partialContent).toBeNull();
  });
});
