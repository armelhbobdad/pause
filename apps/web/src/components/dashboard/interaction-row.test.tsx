import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InteractionRow } from "./interaction-row";

// Mock formatRelativeTime to return predictable values
vi.mock("@/lib/format", () => ({
  formatRelativeTime: vi.fn(() => "3 hours ago"),
}));

function makeInteraction(overrides: Record<string, unknown> = {}) {
  return {
    id: "int-1",
    tier: "analyst",
    outcome: "accepted",
    createdAt: "2026-02-07T12:00:00.000Z",
    savingsAmountCents: null,
    purchaseContext: {
      itemName: "Headphones",
      merchant: "BestBuy",
      category: "Electronics",
    },
    ...overrides,
  };
}

describe("InteractionRow", () => {
  const onToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the merchant and category from purchase context", () => {
    render(
      <InteractionRow
        interaction={makeInteraction()}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.getByText("BestBuy \u00b7 Electronics")).toBeInTheDocument();
  });

  it("renders relative time", () => {
    render(
      <InteractionRow
        interaction={makeInteraction()}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.getByTestId("time-int-1")).toHaveTextContent("3 hours ago");
  });

  it("renders tier color dot", () => {
    render(
      <InteractionRow
        interaction={makeInteraction({ tier: "negotiator" })}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    const dot = screen.getByTestId("tier-dot-int-1");
    expect(dot).toBeInTheDocument();
  });

  it("renders outcome indicator with correct label", () => {
    render(
      <InteractionRow
        interaction={makeInteraction({ outcome: "overridden" })}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.getByLabelText("Overridden")).toBeInTheDocument();
  });

  it("renders savings badge when savings exist", () => {
    render(
      <InteractionRow
        interaction={makeInteraction({ savingsAmountCents: 1500 })}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    const badge = screen.getByTestId("savings-badge-int-1");
    expect(badge).toHaveTextContent("$15.00");
  });

  it("does not render savings badge when no savings", () => {
    render(
      <InteractionRow
        interaction={makeInteraction({ savingsAmountCents: null })}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.queryByTestId("savings-badge-int-1")).not.toBeInTheDocument();
  });

  it("calls onToggle when clicked", async () => {
    const user = userEvent.setup();
    render(
      <InteractionRow
        interaction={makeInteraction()}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    await user.click(screen.getByTestId("interaction-row-int-1"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("sets aria-expanded correctly", () => {
    const { rerender } = render(
      <InteractionRow
        interaction={makeInteraction()}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.getByTestId("interaction-row-int-1")).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    rerender(
      <InteractionRow
        interaction={makeInteraction()}
        isExpanded={true}
        onToggle={onToggle}
      />
    );

    expect(screen.getByTestId("interaction-row-int-1")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("renders accessible label with tier and outcome", () => {
    render(
      <InteractionRow
        interaction={makeInteraction()}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    const button = screen.getByTestId("interaction-row-int-1");
    expect(button).toHaveAttribute("aria-label");
    const label = button.getAttribute("aria-label") ?? "";
    expect(label).toContain("analyst tier");
    expect(label).toContain("BestBuy");
  });

  it("renders gold star icon for accepted with savings", () => {
    render(
      <InteractionRow
        interaction={makeInteraction({
          outcome: "accepted",
          savingsAmountCents: 500,
        })}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.getByLabelText("Saved")).toBeInTheDocument();
  });

  it("renders gray dash for abandoned outcome", () => {
    render(
      <InteractionRow
        interaction={makeInteraction({ outcome: "abandoned" })}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.getByLabelText("Abandoned")).toBeInTheDocument();
  });

  it("renders gray dash for timeout outcome", () => {
    render(
      <InteractionRow
        interaction={makeInteraction({ outcome: "timeout" })}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.getByLabelText("Timed out")).toBeInTheDocument();
  });

  it("handles null purchase context gracefully", () => {
    render(
      <InteractionRow
        interaction={makeInteraction({ purchaseContext: null })}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    // Should show outcome label as fallback
    expect(screen.getByTestId("interaction-row-int-1")).toBeInTheDocument();
  });

  it("handles null outcome gracefully", () => {
    render(
      <InteractionRow
        interaction={makeInteraction({ outcome: null })}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    expect(screen.getByLabelText("Pending")).toBeInTheDocument();
  });
});
