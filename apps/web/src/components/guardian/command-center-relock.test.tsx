import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardData } from "./card-vault";
import { CommandCenter } from "./command-center";

// --- Mocks (same set as command-center.test.tsx) ---

// CardVault is now self-contained (BorderTimer is internal), no countdown-timer mock needed

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    size,
    variant,
  }: {
    children?: string;
    onClick?: () => void;
    size?: string;
    variant?: string;
  }) => (
    <button
      data-size={size}
      data-variant={variant}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  ),
}));

// Configurable mock for state override
const guardianStateOverride = vi.hoisted(() => ({
  value: null as Record<string, unknown> | null,
}));

vi.mock("@/hooks/use-guardian-state", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/use-guardian-state")>();
  return {
    ...actual,
    useGuardianState: (options?: unknown) => {
      if (guardianStateOverride.value) {
        return guardianStateOverride.value;
      }
      // biome-ignore lint/correctness/useHookAtTopLevel: Test mock wrapper — conditional controls whether real hook or mock runs.
      return actual.useGuardianState(
        options as Parameters<typeof actual.useGuardianState>[0]
      );
    },
  };
});

// Mock sonner toast to capture calls
const mockToastInfo = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: {
    info: mockToastInfo,
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

const mockCard: CardData = {
  id: "card-1",
  userId: "user-1",
  lastFour: "4242",
  nickname: "Test Card",
  status: "active",
  lockedAt: null,
  unlockedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("CommandCenter auto-relock (Story 9.4)", () => {
  const mockRelock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    mockRelock.mockClear();
    mockToastInfo.mockClear();
  });

  afterEach(() => {
    guardianStateOverride.value = null;
    vi.useRealTimers();
  });

  function setRevealedState(
    revealType: "earned" | "override" | "break_glass" = "earned"
  ) {
    guardianStateOverride.value = {
      state: "revealed",
      isActive: false,
      isIdle: false,
      isRevealed: true,
      revealType,
      requestUnlock: vi.fn(),
      onExpansionComplete: vi.fn(),
      onResponseReceived: vi.fn(),
      onCollapseComplete: vi.fn(),
      revealApproved: vi.fn(),
      revealOverride: vi.fn(),
      guardianError: vi.fn(),
      relock: mockRelock,
      dispatch: vi.fn(),
    };
  }

  it("shows relock timer in revealed state", () => {
    setRevealedState("earned");
    render(<CommandCenter card={mockCard} />);
    expect(screen.getByRole("timer")).toBeInTheDocument();
  });

  it("does not show relock timer in idle state", () => {
    // Default state (no override) is idle
    render(<CommandCenter card={mockCard} />);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("does not show relock timer in break glass state", () => {
    setRevealedState("break_glass");
    render(<CommandCenter card={mockCard} />);
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  });

  it("auto-relock dispatches RELOCK after timeout", () => {
    setRevealedState("earned");
    render(<CommandCenter card={mockCard} relockTimeoutMs={5000} />);

    expect(mockRelock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockRelock).toHaveBeenCalledOnce();
  });

  it("shows toast on auto-relock", () => {
    setRevealedState("earned");
    render(<CommandCenter card={mockCard} relockTimeoutMs={5000} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      "Card re-locked for your protection",
      { duration: 3000 }
    );
  });

  it("calls onAutoRelock callback when timer expires", () => {
    setRevealedState("earned");
    const onAutoRelock = vi.fn();
    render(
      <CommandCenter
        card={mockCard}
        onAutoRelock={onAutoRelock}
        relockTimeoutMs={5000}
      />
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onAutoRelock).toHaveBeenCalledOnce();
  });

  it("uses default 5-minute timeout", () => {
    setRevealedState("earned");
    render(<CommandCenter card={mockCard} />);

    // Should not relock before 5 minutes
    act(() => {
      vi.advanceTimersByTime(299_999);
    });
    expect(mockRelock).not.toHaveBeenCalled();

    // Should relock at 5 minutes
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockRelock).toHaveBeenCalledOnce();
  });

  it("accepts custom relockTimeoutMs for production use", () => {
    setRevealedState("earned");
    // 30 minutes = 1_800_000ms
    render(<CommandCenter card={mockCard} relockTimeoutMs={1_800_000} />);

    // Should not relock at 5 minutes
    act(() => {
      vi.advanceTimersByTime(300_000);
    });
    expect(mockRelock).not.toHaveBeenCalled();

    // Should relock at 30 minutes
    act(() => {
      vi.advanceTimersByTime(1_500_000);
    });
    expect(mockRelock).toHaveBeenCalledOnce();
  });
});
