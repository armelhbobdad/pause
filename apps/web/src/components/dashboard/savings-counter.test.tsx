import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SavingsCounter } from "./savings-counter";

describe("SavingsCounter", () => {
  let rafCallbacks: Array<(time: number) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
  });

  it("renders $0.00 initially for zero value", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);

    render(<SavingsCounter totalCents={0} />);

    expect(screen.getByTestId("savings-counter-value")).toHaveTextContent(
      "$0.00"
    );
    expect(screen.getByText("saved")).toBeInTheDocument();
  });

  it("animates count-up from 0 to target", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);

    render(<SavingsCounter totalCents={5000} />);

    // Initial RAF requested
    expect(rafCallbacks).toHaveLength(1);

    // Simulate mid-animation (250ms = 50% through 500ms duration)
    vi.spyOn(performance, "now").mockReturnValue(250);
    act(() => {
      rafCallbacks[0](250);
    });

    // Value should be partially animated (ease-out: not exactly 50%)
    const midValue = screen.getByTestId("savings-counter-value").textContent;
    expect(midValue).not.toBe("$0.00");
    expect(midValue).not.toBe("$50.00");

    // Simulate end of animation (500ms)
    vi.spyOn(performance, "now").mockReturnValue(500);
    const lastCallback = rafCallbacks.at(-1);
    expect(lastCallback).toBeDefined();
    act(() => {
      lastCallback?.(500);
    });

    expect(screen.getByTestId("savings-counter-value")).toHaveTextContent(
      "$50.00"
    );
  });

  it("uses ease-out easing (faster at start, slower at end)", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);

    render(<SavingsCounter totalCents={10_000} />);

    // At 25% time (125ms), ease-out should be past 25% progress
    vi.spyOn(performance, "now").mockReturnValue(125);
    act(() => {
      rafCallbacks[0](125);
    });

    const earlyValue = screen
      .getByTestId("savings-counter-value")
      .textContent?.replace(/[^0-9.]/g, "");
    const earlyDollars = Number.parseFloat(earlyValue ?? "0");

    // ease-out: 1 - (1 - 0.25)^3 = 1 - 0.421875 = 0.578125 => ~$57.81 of $100
    // Should be > 25% ($25) of the target
    expect(earlyDollars).toBeGreaterThan(25);
  });

  it("has correct ARIA attributes for accessibility", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);

    render(<SavingsCounter totalCents={0} />);

    const counter = screen.getByTestId("savings-counter");
    // <output> element implicitly has role="status"
    expect(counter.tagName).toBe("OUTPUT");
    expect(counter).toHaveAttribute("aria-live", "polite");
  });

  it("applies savings-gold color", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);

    render(<SavingsCounter totalCents={1000} />);

    const valueEl = screen.getByTestId("savings-counter-value");
    expect(valueEl.style.color).toBe("var(--savings-gold)");
  });

  it("applies JetBrains Mono font", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);

    render(<SavingsCounter totalCents={1000} />);

    const valueEl = screen.getByTestId("savings-counter-value");
    expect(valueEl.style.fontFamily).toBe("var(--font-data)");
  });

  it("formats cents as dollars correctly", () => {
    vi.spyOn(performance, "now").mockReturnValue(0);

    render(<SavingsCounter totalCents={12_345} />);

    // Complete the animation
    vi.spyOn(performance, "now").mockReturnValue(600);
    act(() => {
      rafCallbacks[0](600);
    });

    expect(screen.getByTestId("savings-counter-value")).toHaveTextContent(
      "$123.45"
    );
  });
});
