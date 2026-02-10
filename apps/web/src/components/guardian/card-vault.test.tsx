import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CardData } from "./card-vault";
import { CardVault } from "./card-vault";

const LAST_FOUR_PATTERN = /4242/;

// Mock dependencies
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

const mockCard: CardData = {
  id: "card-1",
  userId: "user-1",
  lastFour: "4242",
  nickname: "Vacation Fund",
  status: "active",
  lockedAt: null,
  unlockedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("CardVault", () => {
  // ==========================================================================
  // Empty State
  // ==========================================================================

  describe("empty state", () => {
    it("renders empty state when card is null", () => {
      render(<CardVault card={null} />);
      expect(
        screen.getByLabelText("No card linked. Add a card to get started.")
      ).toBeInTheDocument();
    });

    it("shows 'Secure your first card.' text in empty state", () => {
      render(<CardVault card={null} />);
      expect(screen.getByText("Secure your first card.")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Card Display
  // ==========================================================================

  describe("card display", () => {
    it("renders last four digits with mask", () => {
      render(<CardVault card={mockCard} />);
      expect(screen.getByText(LAST_FOUR_PATTERN)).toBeInTheDocument();
    });

    it("renders card nickname", () => {
      render(<CardVault card={mockCard} />);
      expect(screen.getByText("Vacation Fund")).toBeInTheDocument();
    });

    it("renders 'My Card' when nickname is null", () => {
      const cardNoNickname = { ...mockCard, nickname: null };
      render(<CardVault card={cardNoNickname} />);
      expect(screen.getByText("My Card")).toBeInTheDocument();
    });

    it("has button role for accessibility", () => {
      render(<CardVault card={mockCard} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("is focusable via tabIndex", () => {
      render(<CardVault card={mockCard} />);
      const button = screen.getByRole("button");
      expect(button.getAttribute("tabindex")).toBe("0");
    });
  });

  // ==========================================================================
  // Click Interaction
  // ==========================================================================

  describe("click interaction", () => {
    it("calls onUnlockRequest when clicked", async () => {
      const user = userEvent.setup();
      const onUnlockRequest = vi.fn();
      render(<CardVault card={mockCard} onUnlockRequest={onUnlockRequest} />);
      await user.click(screen.getByRole("button"));
      expect(onUnlockRequest).toHaveBeenCalledOnce();
    });

    it("does not call onUnlockRequest when already active", async () => {
      const user = userEvent.setup();
      const onUnlockRequest = vi.fn();
      render(
        <CardVault
          card={mockCard}
          isActive={true}
          onUnlockRequest={onUnlockRequest}
        />
      );
      await user.click(screen.getByRole("button"));
      expect(onUnlockRequest).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Keyboard Accessibility
  // ==========================================================================

  describe("keyboard accessibility", () => {
    it("triggers unlock on Enter key", async () => {
      const user = userEvent.setup();
      const onUnlockRequest = vi.fn();
      render(<CardVault card={mockCard} onUnlockRequest={onUnlockRequest} />);
      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("{Enter}");
      expect(onUnlockRequest).toHaveBeenCalledOnce();
    });

    it("triggers unlock on Space key", async () => {
      const user = userEvent.setup();
      const onUnlockRequest = vi.fn();
      render(<CardVault card={mockCard} onUnlockRequest={onUnlockRequest} />);
      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard(" ");
      expect(onUnlockRequest).toHaveBeenCalledOnce();
    });

    it("does not trigger unlock on other keys", async () => {
      const user = userEvent.setup();
      const onUnlockRequest = vi.fn();
      render(<CardVault card={mockCard} onUnlockRequest={onUnlockRequest} />);
      const button = screen.getByRole("button");
      button.focus();
      await user.keyboard("a");
      expect(onUnlockRequest).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // ARIA Labels & Announcements
  // ==========================================================================

  describe("aria labels", () => {
    it("has locked aria-label in idle state", () => {
      render(<CardVault card={mockCard} />);
      expect(
        screen.getByLabelText("Payment card locked. Tap to request unlock.")
      ).toBeInTheDocument();
    });

    it("has processing aria-label when active", () => {
      render(<CardVault card={mockCard} isActive={true} />);
      expect(
        screen.getByLabelText("Guardian analyzing your request. Processing...")
      ).toBeInTheDocument();
    });

    it("has unlocked aria-label when revealed", () => {
      render(<CardVault card={mockCard} isRevealed={true} />);
      expect(
        screen.getByLabelText("Payment card unlocked. Card details visible.")
      ).toBeInTheDocument();
    });

    it("sets aria-busy when active", () => {
      render(<CardVault card={mockCard} isActive={true} />);
      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-busy")).toBe("true");
    });

    it("does not set aria-busy when idle", () => {
      render(<CardVault card={mockCard} />);
      const button = screen.getByRole("button");
      expect(button.getAttribute("aria-busy")).toBe("false");
    });
  });

  // ==========================================================================
  // Live Announcements
  // ==========================================================================

  describe("live announcements (screen reader)", () => {
    it("announces analyzing state", () => {
      render(<CardVault card={mockCard} isActive={true} />);
      expect(
        screen.getByText("Guardian is analyzing your unlock request")
      ).toBeInTheDocument();
    });

    it("announces earned reveal", () => {
      render(
        <CardVault card={mockCard} isRevealed={true} revealType="earned" />
      );
      expect(
        screen.getByText("Card unlocked. Details now visible.")
      ).toBeInTheDocument();
    });

    it("announces override reveal with different text", () => {
      render(
        <CardVault card={mockCard} isRevealed={true} revealType="override" />
      );
      expect(
        screen.getByText(
          "Card unlocked. You chose to skip the Guardian's suggestion."
        )
      ).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Countdown Timer
  // ==========================================================================

  describe("border timer", () => {
    it("shows border timer SVG when revealed and showCountdown is true", () => {
      const { container } = render(
        <CardVault card={mockCard} isRevealed={true} showCountdown={true} />
      );
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });

    it("does not show border timer when not revealed", () => {
      const { container } = render(
        <CardVault card={mockCard} showCountdown={true} />
      );
      const svg = container.querySelector("svg");
      expect(svg).not.toBeInTheDocument();
    });

    it("does not show border timer when showCountdown is false", () => {
      const { container } = render(
        <CardVault card={mockCard} isRevealed={true} />
      );
      const svg = container.querySelector("svg");
      expect(svg).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Pulse Animation
  // ==========================================================================

  describe("pulse animation", () => {
    it("applies pulse animation class when active", () => {
      render(<CardVault card={mockCard} isActive={true} />);
      const button = screen.getByRole("button");
      expect(button.className).toContain("animate-guardian-pulse");
    });

    it("does not apply pulse animation when idle", () => {
      render(<CardVault card={mockCard} />);
      const button = screen.getByRole("button");
      expect(button.className).not.toContain("animate-guardian-pulse");
    });
  });
});
