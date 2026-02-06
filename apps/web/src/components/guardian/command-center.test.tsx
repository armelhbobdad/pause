import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

function fireTransitionEnd(element: HTMLElement, propertyName: string) {
  const event = new Event("transitionend", { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  act(() => {
    element.dispatchEvent(event);
  });
}

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

    it("renders guardian content inside conversation area", () => {
      render(
        <CommandCenter
          card={mockCard}
          guardianContent={<p>Guardian says hello</p>}
        />
      );
      expect(screen.getByText("Guardian says hello")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Tier Prop Passthrough
  // ==========================================================================

  describe("tier prop", () => {
    it("defaults tier to negotiator", () => {
      const { container } = render(<CommandCenter card={mockCard} />);
      const conversation = container.querySelector("[data-tier]");
      expect(conversation?.getAttribute("data-tier")).toBe("negotiator");
    });

    it("passes tier to GuardianConversation", () => {
      const { container } = render(
        <CommandCenter card={mockCard} tier="therapist" />
      );
      const conversation = container.querySelector("[data-tier]");
      expect(conversation?.getAttribute("data-tier")).toBe("therapist");
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
    it("card vault click activates GuardianConversation expansion", async () => {
      const user = userEvent.setup();
      const { container } = render(<CommandCenter card={mockCard} />);

      const conversation = container.querySelector(
        "[data-tier]"
      ) as HTMLElement;
      expect(conversation.style.gridTemplateRows).toBe("0fr");

      // Click card vault → expanding → isActive=true
      await user.click(screen.getByRole("button"));

      expect(conversation.style.gridTemplateRows).toBe("1fr");
      expect(conversation.dataset.active).toBeDefined();
    });

    it("expansion complete keeps Guardian active", async () => {
      const user = userEvent.setup();
      const { container } = render(<CommandCenter card={mockCard} />);

      // Click to expand
      await user.click(screen.getByRole("button"));

      const conversation = container.querySelector(
        "[data-tier]"
      ) as HTMLElement;

      // Fire transitionend → expanding → active
      fireTransitionEnd(conversation, "grid-template-rows");

      // Still active (conversation expanded, feed inert)
      expect(conversation.style.gridTemplateRows).toBe("1fr");
      expect(conversation.dataset.active).toBeDefined();
      const section = container.querySelector("section");
      expect(section?.hasAttribute("inert")).toBe(true);
    });
  });
});
