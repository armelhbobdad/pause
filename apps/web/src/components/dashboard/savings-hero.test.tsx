import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SavingsHero } from "./savings-hero";

describe("SavingsHero", () => {
  it("renders animated counter with total saved", () => {
    render(
      <SavingsHero
        acceptanceRate={80}
        interactionCount={5}
        totalSavedCents={12_345}
      />
    );

    expect(screen.getByTestId("savings-counter")).toBeInTheDocument();
  });

  it("renders interaction count with plural", () => {
    render(
      <SavingsHero
        acceptanceRate={66.7}
        interactionCount={3}
        totalSavedCents={500}
      />
    );

    expect(screen.getByTestId("interaction-count")).toHaveTextContent(
      "3 Guardian interactions"
    );
  });

  it("renders interaction count with singular", () => {
    render(
      <SavingsHero
        acceptanceRate={100}
        interactionCount={1}
        totalSavedCents={500}
      />
    );

    expect(screen.getByTestId("interaction-count")).toHaveTextContent(
      "1 Guardian interaction"
    );
  });

  it("renders acceptance rate", () => {
    render(
      <SavingsHero
        acceptanceRate={83.3}
        interactionCount={6}
        totalSavedCents={5300}
      />
    );

    expect(screen.getByTestId("acceptance-rate")).toHaveTextContent(
      "83% acceptance"
    );
  });

  it("renders zero state correctly", () => {
    render(
      <SavingsHero
        acceptanceRate={0}
        interactionCount={0}
        totalSavedCents={0}
      />
    );

    expect(
      screen.getByText("Every spend triggers a check.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("interaction-count")).not.toBeInTheDocument();
  });

  it("has correct ARIA attributes", () => {
    render(
      <SavingsHero
        acceptanceRate={0}
        interactionCount={0}
        totalSavedCents={0}
      />
    );

    const region = screen.getByRole("region", { name: "Total savings" });
    expect(region).toBeInTheDocument();
  });

  it("renders SavingsBreakdown when savingsDetail is provided", () => {
    render(
      <SavingsHero
        acceptanceRate={100}
        interactionCount={2}
        savingsDetail={{
          totalCents: 6200,
          dealCount: 2,
          avgCents: 3100,
          sourceBreakdown: [
            { source: "TechDeals", totalCents: 4200, count: 1 },
          ],
        }}
        totalSavedCents={6200}
      />
    );

    expect(screen.getByTestId("savings-breakdown")).toBeInTheDocument();
  });

  it("does not render SavingsBreakdown when savingsDetail is undefined", () => {
    render(
      <SavingsHero
        acceptanceRate={80}
        interactionCount={5}
        totalSavedCents={5000}
      />
    );

    expect(screen.queryByTestId("savings-breakdown")).not.toBeInTheDocument();
  });
});
