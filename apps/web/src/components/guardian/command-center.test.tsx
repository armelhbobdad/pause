import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardData } from "./card-vault";
import { CommandCenter } from "./command-center";

// Mock CardVault's dependencies (same mocks as card-vault.test.tsx)
vi.mock("@/components/guardian/countdown-timer", () => ({
  CountdownTimer: ({ durationMs }: { durationMs: number }) => (
    <div data-duration={durationMs} data-testid="countdown-timer" />
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div className={className} data-testid="skeleton" />
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Mock Button for GuardianErrorFallback rendering in break glass tests
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

// Mock NativeDialog to render children directly (no portal)
vi.mock("@/components/uitripled/native-dialog-shadcnui", () => ({
  NativeDialog: ({
    children,
    open,
  }: {
    children?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (open ? <div data-testid="guardian-dialog">{children}</div> : null),
  NativeDialogContent: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  NativeDialogHeader: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  NativeDialogTitle: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  NativeDialogDescription: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Configurable mock for break glass tests (Story 2.6).
// When value is null, the real useGuardianState runs normally.
// Set to a mock return value to simulate break glass state.
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
      // biome-ignore lint/correctness/useHookAtTopLevel: This is a test mock wrapper, not a real React hook. The conditional controls whether the real hook runs or a mock return value is used.
      return actual.useGuardianState(
        options as Parameters<typeof actual.useGuardianState>[0]
      );
    },
  };
});

const DISMISS_REGEX = /dismiss/i;
const MANUAL_UNLOCK_REGEX = /manual unlock/i;

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

describe("CommandCenter", () => {
  // ==========================================================================
  // Layout Structure
  // ==========================================================================

  describe("layout structure", () => {
    it("renders with CSS Grid layout and 40/60 split", () => {
      const { container } = render(<CommandCenter card={mockCard} />);
      const root = container.firstElementChild as HTMLElement;
      expect(root.style.display).toBe("grid");
      expect(root.style.gridTemplateRows).toBe("minmax(0, 2fr) minmax(0, 3fr)");
    });

    it("renders feed content", () => {
      render(<CommandCenter card={mockCard} feedContent={<p>Feed items</p>} />);
      expect(screen.getByText("Feed items")).toBeInTheDocument();
    });

    it("accepts guardianContent prop without error", () => {
      const { container } = render(
        <CommandCenter
          card={mockCard}
          guardianContent={<p>Guardian says hello</p>}
        />
      );
      // guardianContent is passed through to MessageRenderer inside the dialog
      // It won't render until the dialog is opened and messages are present
      expect(container.firstElementChild).toBeTruthy();
    });
  });

  // ==========================================================================
  // Tier Prop Passthrough
  // ==========================================================================

  describe("tier prop", () => {
    it("defaults tier to negotiator in break glass state", () => {
      guardianStateOverride.value = {
        state: "revealed",
        isActive: false,
        isIdle: false,
        isRevealed: true,
        revealType: "break_glass",
        requestUnlock: vi.fn(),
        onExpansionComplete: vi.fn(),
        onResponseReceived: vi.fn(),
        onCollapseComplete: vi.fn(),
        revealApproved: vi.fn(),
        revealOverride: vi.fn(),
        guardianError: vi.fn(),
        relock: vi.fn(),
        dispatch: vi.fn(),
      };
      const { container } = render(<CommandCenter card={mockCard} />);
      const conversation = container.querySelector("[data-tier]");
      expect(conversation?.getAttribute("data-tier")).toBe("negotiator");
      guardianStateOverride.value = null;
    });

    it("passes tier to GuardianConversation in break glass state", () => {
      guardianStateOverride.value = {
        state: "revealed",
        isActive: false,
        isIdle: false,
        isRevealed: true,
        revealType: "break_glass",
        requestUnlock: vi.fn(),
        onExpansionComplete: vi.fn(),
        onResponseReceived: vi.fn(),
        onCollapseComplete: vi.fn(),
        revealApproved: vi.fn(),
        revealOverride: vi.fn(),
        guardianError: vi.fn(),
        relock: vi.fn(),
        dispatch: vi.fn(),
      };
      const { container } = render(
        <CommandCenter card={mockCard} tier="therapist" />
      );
      const conversation = container.querySelector("[data-tier]");
      expect(conversation?.getAttribute("data-tier")).toBe("therapist");
      guardianStateOverride.value = null;
    });
  });

  // ==========================================================================
  // Feed Inert Attribute (UX-90)
  // ==========================================================================

  describe("feed inert (UX-90)", () => {
    it("feed section does not have inert in idle state", () => {
      const { container } = render(<CommandCenter card={mockCard} />);
      const section = container.querySelector("section");
      expect(section?.hasAttribute("inert")).toBe(false);
    });

    it("feed section receives inert when Guardian is active", async () => {
      const user = userEvent.setup();
      const { container } = render(<CommandCenter card={mockCard} />);

      // Click card vault → expanding → isActive=true
      await user.click(screen.getByRole("button"));

      const section = container.querySelector("section");
      expect(section?.hasAttribute("inert")).toBe(true);
    });
  });

  // ==========================================================================
  // State Machine Integration
  // ==========================================================================

  describe("state machine integration", () => {
    it("card vault click opens Guardian dialog", async () => {
      const user = userEvent.setup();
      render(<CommandCenter card={mockCard} />);

      // Dialog should not be open initially
      expect(screen.queryByTestId("guardian-dialog")).not.toBeInTheDocument();

      // Click card vault → expanding → isActive=true → dialog opens
      await user.click(screen.getByRole("button"));

      expect(screen.getByTestId("guardian-dialog")).toBeInTheDocument();
      expect(screen.getByText("What are you buying?")).toBeInTheDocument();
    });

    it("feed section receives inert when Guardian is active via dialog", async () => {
      const user = userEvent.setup();
      const { container } = render(<CommandCenter card={mockCard} />);

      // Click to activate
      await user.click(screen.getByRole("button"));

      // Feed section should be inert
      const section = container.querySelector("section");
      expect(section?.hasAttribute("inert")).toBe(true);
    });
  });

  // ==========================================================================
  // Break Glass Error Fallback (Story 2.6)
  // ==========================================================================

  describe("break glass error fallback (Story 2.6)", () => {
    const mockRelock = vi.fn();

    beforeEach(() => {
      mockRelock.mockClear();
      guardianStateOverride.value = {
        state: "revealed",
        isActive: false,
        isIdle: false,
        isRevealed: true,
        revealType: "break_glass",
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
    });

    afterEach(() => {
      guardianStateOverride.value = null;
    });

    it("shows error fallback when in break glass state", () => {
      render(<CommandCenter card={mockCard} />);
      expect(
        screen.getByText("Guardian unavailable. You can unlock manually.")
      ).toBeInTheDocument();
    });

    it("keeps conversation area expanded during break glass", () => {
      const { container } = render(<CommandCenter card={mockCard} />);
      const conversation = container.querySelector(
        "[data-tier]"
      ) as HTMLElement;
      expect(conversation.style.gridTemplateRows).toBe("1fr");
    });

    it("Dismiss button calls relock to return to idle", async () => {
      const user = userEvent.setup();
      render(<CommandCenter card={mockCard} />);
      await user.click(screen.getByRole("button", { name: DISMISS_REGEX }));
      expect(mockRelock).toHaveBeenCalledOnce();
    });

    it("Manual Unlock dismisses fallback without relocking", async () => {
      const user = userEvent.setup();
      render(<CommandCenter card={mockCard} />);
      await user.click(
        screen.getByRole("button", { name: MANUAL_UNLOCK_REGEX })
      );
      expect(mockRelock).not.toHaveBeenCalled();
      expect(
        screen.queryByText("Guardian unavailable. You can unlock manually.")
      ).not.toBeInTheDocument();
    });
  });
});
