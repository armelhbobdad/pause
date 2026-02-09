import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrowserBackProtection } from "@/hooks/use-browser-back-protection";
import type { GuardianState } from "@/hooks/use-guardian-state";

describe("useBrowserBackProtection", () => {
  const pushStateSpy = vi.fn();
  const backSpy = vi.fn();
  const originalPushState = window.history.pushState;
  const originalBack = window.history.back;

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState = pushStateSpy;
    window.history.back = backSpy;
  });

  afterEach(() => {
    window.history.pushState = originalPushState;
    window.history.back = originalBack;
  });

  it("pushes history state when Guardian activates", () => {
    renderHook(() => useBrowserBackProtection({ guardianState: "expanding" }));
    expect(pushStateSpy).toHaveBeenCalledWith({ guardian: true }, "");
  });

  it("removes history entry when Guardian completes (back to idle)", () => {
    const { rerender } = renderHook(
      ({ state }: { state: GuardianState }) =>
        useBrowserBackProtection({ guardianState: state }),
      { initialProps: { state: "expanding" as GuardianState } }
    );

    rerender({ state: "idle" });
    expect(backSpy).toHaveBeenCalled();
  });

  it("does not push state when already idle", () => {
    renderHook(() => useBrowserBackProtection({ guardianState: "idle" }));
    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it("pushes state for active Guardian", () => {
    renderHook(() => useBrowserBackProtection({ guardianState: "active" }));
    expect(pushStateSpy).toHaveBeenCalledWith({ guardian: true }, "");
  });

  it("pushes state for revealed Guardian", () => {
    renderHook(() => useBrowserBackProtection({ guardianState: "revealed" }));
    expect(pushStateSpy).toHaveBeenCalledWith({ guardian: true }, "");
  });

  it("calls onBlocked when popstate fires during active Guardian", () => {
    const onBlocked = vi.fn();
    renderHook(() =>
      useBrowserBackProtection({ guardianState: "active", onBlocked })
    );

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onBlocked).toHaveBeenCalled();
  });

  it("re-pushes state on popstate to prevent navigation", () => {
    renderHook(() => useBrowserBackProtection({ guardianState: "active" }));

    pushStateSpy.mockClear();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(pushStateSpy).toHaveBeenCalledWith({ guardian: true }, "");
  });

  it("does not call onBlocked when Guardian is idle", () => {
    const onBlocked = vi.fn();
    renderHook(() =>
      useBrowserBackProtection({ guardianState: "idle", onBlocked })
    );

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onBlocked).not.toHaveBeenCalled();
  });
});
