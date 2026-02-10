import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SavingsBreakdown } from "./savings-breakdown";

const defaultProps = {
  totalCents: 6200,
  dealCount: 2,
  avgCents: 3100,
  sourceBreakdown: [
    { source: "TechDeals", totalCents: 4200, count: 1 },
    { source: "RetailCo", totalCents: 2000, count: 1 },
  ],
};

describe("SavingsBreakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders toggle with View details text", () => {
    render(<SavingsBreakdown {...defaultProps} />);

    const toggle = screen.getByTestId("savings-breakdown-toggle");
    expect(toggle).toHaveTextContent("View details");
  });

  it("shows empty state when no deals", () => {
    render(
      <SavingsBreakdown
        avgCents={0}
        dealCount={0}
        sourceBreakdown={[]}
        totalCents={0}
      />
    );

    expect(screen.getByTestId("savings-breakdown-empty")).toBeInTheDocument();
    expect(
      screen.getByText("Savings will accumulate as you use the Guardian")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Every spend triggers a check.")
    ).toBeInTheDocument();
  });

  it("details are hidden by default", () => {
    render(<SavingsBreakdown {...defaultProps} />);

    expect(screen.queryByTestId("breakdown-details")).not.toBeInTheDocument();
    expect(screen.getByText("View details")).toBeInTheDocument();
  });

  it("expands to show breakdown on click", async () => {
    const user = userEvent.setup();
    render(<SavingsBreakdown {...defaultProps} />);

    await user.click(screen.getByTestId("savings-breakdown-toggle"));

    expect(screen.getByTestId("breakdown-details")).toBeInTheDocument();
    expect(screen.getByTestId("breakdown-deal-count")).toHaveTextContent("2");
    expect(screen.getByTestId("breakdown-avg")).toHaveTextContent("$31.00");
    expect(screen.getByText("Hide details")).toBeInTheDocument();
  });

  it("shows source breakdown in expanded view", async () => {
    const user = userEvent.setup();
    render(<SavingsBreakdown {...defaultProps} />);

    await user.click(screen.getByTestId("savings-breakdown-toggle"));

    expect(screen.getByTestId("source-TechDeals")).toHaveTextContent("$42.00");
    expect(screen.getByTestId("source-RetailCo")).toHaveTextContent("$20.00");
  });

  it("collapses details on second click", async () => {
    const user = userEvent.setup();
    render(<SavingsBreakdown {...defaultProps} />);

    await user.click(screen.getByTestId("savings-breakdown-toggle"));
    expect(screen.getByTestId("breakdown-details")).toBeInTheDocument();

    await user.click(screen.getByTestId("savings-breakdown-toggle"));
    expect(screen.queryByTestId("breakdown-details")).not.toBeInTheDocument();
  });

  it("toggle button has aria-expanded attribute", async () => {
    const user = userEvent.setup();
    render(<SavingsBreakdown {...defaultProps} />);

    const toggle = screen.getByTestId("savings-breakdown-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("formats monetary values correctly from cents", async () => {
    const user = userEvent.setup();
    render(
      <SavingsBreakdown
        avgCents={4115}
        dealCount={3}
        sourceBreakdown={[
          { source: "CouponSite", totalCents: 12_345, count: 3 },
        ]}
        totalCents={12_345}
      />
    );

    await user.click(screen.getByTestId("savings-breakdown-toggle"));
    expect(screen.getByTestId("breakdown-avg")).toHaveTextContent("$41.15");
  });

  it("has correct ARIA region label", () => {
    render(<SavingsBreakdown {...defaultProps} />);

    const region = screen.getByRole("region", { name: "Savings breakdown" });
    expect(region).toBeInTheDocument();
  });
});
