import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecentInteractions } from "./recent-interactions";

// Mock formatRelativeTime to return predictable values
vi.mock("@/lib/format", () => ({
  formatRelativeTime: vi.fn(() => "2 hours ago"),
}));

const mockInteractions = [
  {
    id: "int-1",
    tier: "analyst",
    outcome: "accepted",
    reasoningSummary: "Low risk grocery purchase",
    createdAt: new Date("2026-02-08T00:00:00Z"),
    cardLastFour: "1234",
  },
  {
    id: "int-2",
    tier: "negotiator",
    outcome: "overridden",
    reasoningSummary: "Found better coupon deal",
    createdAt: new Date("2026-02-07T22:00:00Z"),
    cardLastFour: "5678",
  },
  {
    id: "int-3",
    tier: "therapist",
    outcome: "wait",
    reasoningSummary: "Suggested cooling off period",
    createdAt: new Date("2026-02-07T20:00:00Z"),
    cardLastFour: "9012",
  },
  {
    id: "int-4",
    tier: "analyst",
    outcome: "auto_approved",
    reasoningSummary: null,
    createdAt: new Date("2026-02-07T18:00:00Z"),
    cardLastFour: "3456",
  },
  {
    id: "int-5",
    tier: "negotiator",
    outcome: "accepted",
    reasoningSummary: "Recurring subscription approved",
    createdAt: new Date("2026-02-07T16:00:00Z"),
    cardLastFour: "7890",
  },
];

describe("RecentInteractions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders interaction rows with tier, outcome, and time", () => {
    render(<RecentInteractions interactions={mockInteractions} />);

    // Check tier dots are rendered (2 analyst, 2 negotiator, 1 therapist)
    expect(screen.getAllByLabelText("analyst tier")).toHaveLength(2);
    expect(screen.getAllByLabelText("negotiator tier")).toHaveLength(2);
    expect(screen.getByLabelText("therapist tier")).toBeInTheDocument();

    // Check outcomes
    expect(screen.getAllByText("accepted")).toHaveLength(2);
    expect(screen.getByText("overridden")).toBeInTheDocument();
    expect(screen.getByText("wait")).toBeInTheDocument();

    // Check card last four
    expect(screen.getByText("••1234")).toBeInTheDocument();

    // Check times rendered
    expect(screen.getByTestId("time-int-1")).toHaveTextContent("2 hours ago");
  });

  it("renders empty state", () => {
    render(<RecentInteractions interactions={[]} />);

    expect(screen.getByTestId("empty-interactions")).toHaveTextContent(
      "No interactions yet. Your Guardian is standing by."
    );
  });

  it("expandable detail shows reasoningSummary", async () => {
    const user = userEvent.setup();
    render(<RecentInteractions interactions={mockInteractions} />);

    // Detail should not be visible initially
    expect(screen.queryByTestId("detail-int-1")).not.toBeInTheDocument();

    // Click to expand
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]);

    // Detail should now be visible
    expect(screen.getByTestId("detail-int-1")).toHaveTextContent(
      "Low risk grocery purchase"
    );

    // Click again to collapse
    await user.click(buttons[0]);
    expect(screen.queryByTestId("detail-int-1")).not.toBeInTheDocument();
  });

  it("limits to 5 items", () => {
    render(<RecentInteractions interactions={mockInteractions} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
  });

  it("displays correct relative time", () => {
    render(<RecentInteractions interactions={[mockInteractions[0]]} />);

    expect(screen.getByTestId("time-int-1")).toHaveTextContent("2 hours ago");
  });
});
