import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatSuppression } from "@/hooks/use-chat-suppression";
import type { GuardianState } from "@/hooks/use-guardian-state";

describe("useChatSuppression", () => {
  const closeChat = vi.fn();
  const getDraft = vi.fn(() => "draft text");

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("force-closes chat when Guardian transitions to expanding", () => {
    const { rerender } = renderHook(
      ({ state }: { state: GuardianState }) =>
        useChatSuppression({
          guardianState: state,
          isChatOpen: true,
          closeChat,
          getDraft,
        }),
      { initialProps: { state: "idle" as GuardianState } }
    );

    rerender({ state: "expanding" });
    expect(closeChat).toHaveBeenCalledOnce();
  });

  it("saves draft to sessionStorage before closing", () => {
    const { rerender } = renderHook(
      ({ state }: { state: GuardianState }) =>
        useChatSuppression({
          guardianState: state,
          isChatOpen: true,
          closeChat,
          getDraft,
        }),
      { initialProps: { state: "idle" as GuardianState } }
    );

    rerender({ state: "expanding" });
    expect(sessionStorage.getItem("pause-chat-draft")).toBe("draft text");
  });

  it("does not close chat if chat is already closed", () => {
    const { rerender } = renderHook(
      ({ state }: { state: GuardianState }) =>
        useChatSuppression({
          guardianState: state,
          isChatOpen: false,
          closeChat,
          getDraft,
        }),
      { initialProps: { state: "idle" as GuardianState } }
    );

    rerender({ state: "expanding" });
    expect(closeChat).not.toHaveBeenCalled();
  });

  it("restores draft from sessionStorage", () => {
    sessionStorage.setItem("pause-chat-draft", "saved draft");
    const { result } = renderHook(() =>
      useChatSuppression({
        guardianState: "idle",
        isChatOpen: false,
        closeChat,
        getDraft,
      })
    );

    const restored = result.current.restoreDraft();
    expect(restored).toBe("saved draft");
  });

  it("clears draft from sessionStorage after restore", () => {
    sessionStorage.setItem("pause-chat-draft", "saved draft");
    const { result } = renderHook(() =>
      useChatSuppression({
        guardianState: "idle",
        isChatOpen: false,
        closeChat,
        getDraft,
      })
    );

    result.current.restoreDraft();
    expect(sessionStorage.getItem("pause-chat-draft")).toBeNull();
  });

  it("clearDraft removes draft from sessionStorage", () => {
    sessionStorage.setItem("pause-chat-draft", "saved draft");
    const { result } = renderHook(() =>
      useChatSuppression({
        guardianState: "idle",
        isChatOpen: false,
        closeChat,
        getDraft,
      })
    );

    result.current.clearDraft();
    expect(sessionStorage.getItem("pause-chat-draft")).toBeNull();
  });
});
