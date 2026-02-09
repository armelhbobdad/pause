import { describe, expect, it } from "vitest";
import { useChatAvailability } from "@/hooks/use-chat-availability";
import type { GuardianState } from "@/hooks/use-guardian-state";

describe("useChatAvailability", () => {
  it("is available when user is unauthenticated", () => {
    const result = useChatAvailability({
      guardianState: "idle",
      isAuthenticated: false,
      isDemoMode: false,
    });
    expect(result.isAvailable).toBe(true);
  });

  it("is available when authenticated and idle", () => {
    const result = useChatAvailability({
      guardianState: "idle",
      isAuthenticated: true,
      isDemoMode: false,
    });
    expect(result.isAvailable).toBe(true);
  });

  it("is unavailable during demo mode", () => {
    const result = useChatAvailability({
      guardianState: "idle",
      isAuthenticated: true,
      isDemoMode: true,
    });
    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe("Demo mode active");
  });

  it("is unavailable during expanding state", () => {
    const result = useChatAvailability({
      guardianState: "expanding",
      isAuthenticated: true,
      isDemoMode: false,
    });
    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe("Guardian is activating");
  });

  it("is unavailable during active state", () => {
    const result = useChatAvailability({
      guardianState: "active",
      isAuthenticated: true,
      isDemoMode: false,
    });
    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe("Guardian session in progress");
  });

  it("is unavailable during collapsing state", () => {
    const result = useChatAvailability({
      guardianState: "collapsing",
      isAuthenticated: true,
      isDemoMode: false,
    });
    expect(result.isAvailable).toBe(false);
  });

  it("is unavailable during revealed state (celebrating)", () => {
    const result = useChatAvailability({
      guardianState: "revealed",
      isAuthenticated: true,
      isDemoMode: false,
    });
    expect(result.isAvailable).toBe(false);
    expect(result.reason).toBe("Viewing results");
  });

  it("demo mode takes priority over guardian state", () => {
    const states: GuardianState[] = [
      "idle",
      "expanding",
      "active",
      "collapsing",
      "revealed",
    ];
    for (const state of states) {
      // biome-ignore lint/correctness/useHookAtTopLevel: pure function, not a React hook despite the naming
      const result = useChatAvailability({
        guardianState: state,
        isAuthenticated: true,
        isDemoMode: true,
      });
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toBe("Demo mode active");
    }
  });
});
