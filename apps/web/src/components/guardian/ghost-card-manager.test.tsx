import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GhostCardManagerProvider,
  useGhostCardManager,
} from "./ghost-card-manager";

function wrapper({ children }: { children: ReactNode }) {
  return <GhostCardManagerProvider>{children}</GhostCardManagerProvider>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GhostCardManager", () => {
  it("allows up to 3 concurrent de-frosts", () => {
    const { result } = renderHook(() => useGhostCardManager(), { wrapper });

    expect(result.current.requestDefrost("card-1")).toBe(true);
    expect(result.current.requestDefrost("card-2")).toBe(true);
    expect(result.current.requestDefrost("card-3")).toBe(true);
  });

  it("returns false for 4th requestDefrost", () => {
    const { result } = renderHook(() => useGhostCardManager(), { wrapper });

    result.current.requestDefrost("card-1");
    result.current.requestDefrost("card-2");
    result.current.requestDefrost("card-3");
    expect(result.current.requestDefrost("card-4")).toBe(false);
  });

  it("returns true for already-active card", () => {
    const { result } = renderHook(() => useGhostCardManager(), { wrapper });

    result.current.requestDefrost("card-1");
    expect(result.current.requestDefrost("card-1")).toBe(true);
  });

  it("queued card de-frosts after slot opens via reportFrosted", () => {
    const { result } = renderHook(() => useGhostCardManager(), { wrapper });

    result.current.requestDefrost("card-1");
    result.current.requestDefrost("card-2");
    result.current.requestDefrost("card-3");
    result.current.requestDefrost("card-4"); // queued

    // Free a slot
    result.current.reportFrosted("card-1");

    // Advance stagger timer
    vi.advanceTimersByTime(100);

    // Now card-4 should be active
    expect(result.current.requestDefrost("card-4")).toBe(true);
  });

  it("uses 100ms stagger between queued de-frosts", () => {
    const { result } = renderHook(() => useGhostCardManager(), { wrapper });

    result.current.requestDefrost("card-1");
    result.current.requestDefrost("card-2");
    result.current.requestDefrost("card-3");
    result.current.requestDefrost("card-4"); // queued

    result.current.reportFrosted("card-1");

    // Before stagger delay, card-4 should not be promoted yet
    vi.advanceTimersByTime(50);
    // After 100ms stagger, card-4 is promoted
    vi.advanceTimersByTime(50);

    expect(result.current.requestDefrost("card-4")).toBe(true);
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useGhostCardManager());
    }).toThrow(
      "useGhostCardManager must be used within GhostCardManagerProvider"
    );
  });
});
