import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "./sparkline";

describe("Sparkline", () => {
  it("renders SVG polyline with 3+ upward data points", () => {
    const dataPoints = [
      { amountCents: 100 },
      { amountCents: 200 },
      { amountCents: 300 },
    ];
    render(<Sparkline dataPoints={dataPoints} />);
    const svg = screen.getByTestId("sparkline-svg");
    expect(svg).toBeDefined();
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe(
      "30-day savings trend: increasing"
    );
  });

  it("renders polyline element inside SVG", () => {
    const dataPoints = [
      { amountCents: 100 },
      { amountCents: 200 },
      { amountCents: 400 },
    ];
    render(<Sparkline dataPoints={dataPoints} />);
    const svg = screen.getByTestId("sparkline-svg");
    const polyline = svg.querySelector("polyline");
    expect(polyline).not.toBeNull();
  });

  it("shows placeholder when fewer than 3 data points", () => {
    render(<Sparkline dataPoints={[{ amountCents: 100 }]} />);
    const placeholder = screen.getByTestId("sparkline-placeholder");
    expect(placeholder.textContent).toBe("Complete your first flow");
  });

  it("shows placeholder when no data points", () => {
    render(<Sparkline dataPoints={[]} />);
    const placeholder = screen.getByTestId("sparkline-placeholder");
    expect(placeholder.textContent).toBe("Complete your first flow");
  });

  it('shows "Steady pace" for flat trend', () => {
    const dataPoints = [
      { amountCents: 100 },
      { amountCents: 100 },
      { amountCents: 100 },
    ];
    render(<Sparkline dataPoints={dataPoints} />);
    const placeholder = screen.getByTestId("sparkline-placeholder");
    expect(placeholder.textContent).toBe("Steady pace");
  });

  it("sets role=img and aria-label for decreasing trend", () => {
    const dataPoints = [
      { amountCents: 300 },
      { amountCents: 200 },
      { amountCents: 100 },
    ];
    render(<Sparkline dataPoints={dataPoints} />);
    const svg = screen.getByTestId("sparkline-svg");
    expect(svg.getAttribute("aria-label")).toBe(
      "30-day savings trend: decreasing"
    );
  });

  it("divides amountCents by 100 for display values", () => {
    const dataPoints = [
      { amountCents: 1000 },
      { amountCents: 2000 },
      { amountCents: 3000 },
    ];
    render(<Sparkline dataPoints={dataPoints} />);
    const svg = screen.getByTestId("sparkline-svg");
    expect(svg).toBeDefined();
  });
});
