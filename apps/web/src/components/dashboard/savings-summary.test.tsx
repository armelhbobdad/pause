import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SavingsSummary } from "./savings-summary";

describe("SavingsSummary", () => {
  it("renders formatted currency from cents", () => {
    render(
      <SavingsSummary
        acceptanceRate={80}
        interactionCount={5}
        totalSavedCents={12_345}
      />
    );

    expect(screen.getByTestId("total-saved")).toHaveTextContent("$123.45");
  });

  it("renders interaction count", () => {
    render(
      <SavingsSummary
        acceptanceRate={66.7}
        interactionCount={3}
        totalSavedCents={500}
      />
    );

    expect(screen.getByTestId("interaction-count")).toHaveTextContent(
      "3 Guardian interactions"
    );
  });

  it("renders zero state correctly", () => {
    render(
      <SavingsSummary
        acceptanceRate={0}
        interactionCount={0}
        totalSavedCents={0}
      />
    );

    expect(screen.getByTestId("total-saved")).toHaveTextContent("$0.00");
    expect(
      screen.getByText("Every spend triggers a check.")
    ).toBeInTheDocument();
  });

  it("has correct ARIA attributes", () => {
    render(
      <SavingsSummary
        acceptanceRate={0}
        interactionCount={0}
        totalSavedCents={0}
      />
    );

    const region = screen.getByRole("region", { name: "Total savings" });
    expect(region).toBeInTheDocument();
  });
});
