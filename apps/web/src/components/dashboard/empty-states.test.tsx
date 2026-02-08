import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  GhostFeedEmptyState,
  HistoryEmptyState,
  SavingsEmptyState,
} from "./empty-states";
import { RecentInteractions } from "./recent-interactions";
import { SavingsBreakdown } from "./savings-breakdown";

vi.mock("@/lib/format", () => ({
  formatRelativeTime: vi.fn(() => "1 hour ago"),
}));

describe("HistoryEmptyState", () => {
  it("renders correct copy", () => {
    render(<HistoryEmptyState />);

    expect(screen.getByText("No history yet")).toBeInTheDocument();
    expect(
      screen.getByText("No unlock requests yet. Tap your card to try it out!")
    ).toBeInTheDocument();
  });

  it("renders CTA when onAction is provided", () => {
    render(
      <HistoryEmptyState
        onAction={() => {
          /* noop */
        }}
      />
    );

    expect(
      screen.getByRole("button", { name: "Try it out" })
    ).toBeInTheDocument();
  });
});

describe("GhostFeedEmptyState", () => {
  it("renders correct copy", () => {
    render(<GhostFeedEmptyState />);

    expect(screen.getByText("No reflections yet")).toBeInTheDocument();
    expect(
      screen.getByText("Your spending reflections will appear here")
    ).toBeInTheDocument();
  });
});

describe("SavingsEmptyState", () => {
  it("renders correct copy with micro-copy", () => {
    render(<SavingsEmptyState />);

    expect(screen.getByText("$0.00 saved")).toBeInTheDocument();
    expect(
      screen.getByText("Savings will accumulate as you use the Guardian")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Every spend triggers a check.")
    ).toBeInTheDocument();
  });
});

describe("Conditional rendering — empty vs populated", () => {
  it("history section renders empty state when interactions is empty array", () => {
    render(<RecentInteractions interactions={[]} />);

    expect(screen.getByTestId("empty-interactions")).toBeInTheDocument();
    expect(
      screen.getByText("No unlock requests yet. Tap your card to try it out!")
    ).toBeInTheDocument();
  });

  it("history section renders data when interactions are populated", () => {
    render(
      <RecentInteractions
        interactions={[
          {
            id: "int-1",
            tier: "analyst",
            outcome: "accepted",
            reasoningSummary: null,
            createdAt: new Date("2026-02-08"),
            cardLastFour: "1234",
          },
        ]}
      />
    );

    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
    expect(screen.getByText("accepted")).toBeInTheDocument();
  });

  it("savings shows empty state when deal count is 0", () => {
    render(
      <SavingsBreakdown
        avgCents={0}
        dealCount={0}
        sourceBreakdown={[]}
        totalCents={0}
      />
    );

    expect(screen.getByTestId("savings-breakdown-empty")).toBeInTheDocument();
  });

  it("savings renders data when deals are populated", () => {
    render(
      <SavingsBreakdown
        avgCents={3100}
        dealCount={2}
        sourceBreakdown={[]}
        totalCents={6200}
      />
    );

    expect(
      screen.queryByTestId("savings-breakdown-empty")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("savings-breakdown")).toBeInTheDocument();
  });
});
