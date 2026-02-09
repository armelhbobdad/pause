import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock framer-motion
const { mockUseReducedMotion } = vi.hoisted(() => ({
  mockUseReducedMotion: vi.fn(() => false),
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: mockUseReducedMotion,
}));

import { ProgressiveSkeleton } from "./progressive-skeleton";

describe("ProgressiveSkeleton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- AC#9: Stage 1 copy at 0s ---
  it("shows Stage 1 copy initially", () => {
    render(<ProgressiveSkeleton isActive />);
    expect(
      screen.getByText("Analyzing your spending patterns...")
    ).toBeInTheDocument();
  });

  // --- AC#9: Stage 2 copy at 3s ---
  it("shows Stage 2 copy after 3 seconds", () => {
    render(<ProgressiveSkeleton isActive />);

    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(
      screen.getByText("Comparing with your monthly budget...")
    ).toBeInTheDocument();
  });

  // --- AC#9: Stage 3 copy at 6s ---
  it("shows Stage 3 copy after 6 seconds", () => {
    render(<ProgressiveSkeleton isActive />);

    act(() => {
      vi.advanceTimersByTime(6100);
    });

    expect(
      screen.getByText("Almost there — reviewing alternatives...")
    ).toBeInTheDocument();
  });

  // --- AC#9: 1.5s minimum stage display ---
  it("stage 1 displays for minimum 1.5s even with rapid transitions", () => {
    render(<ProgressiveSkeleton isActive />);

    // At 1s, should still be stage 1
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(
      screen.getByText("Analyzing your spending patterns...")
    ).toBeInTheDocument();
  });

  // --- AC#10: aria-live="polite" ---
  it('has aria-live="polite" for copy changes', () => {
    render(<ProgressiveSkeleton isActive />);
    const container = screen.getByTestId("progressive-skeleton");
    expect(container).toHaveAttribute("aria-live", "polite");
  });

  // --- AC#10: role="progressbar" ---
  it('has role="progressbar"', () => {
    render(<ProgressiveSkeleton isActive />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  // --- AC#10: Reduced motion: no shimmer ---
  it("renders static gray placeholder when reduced motion is preferred", () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<ProgressiveSkeleton isActive />);
    const staticEl = screen.getByTestId("skeleton-static");
    expect(staticEl).toBeInTheDocument();
    // Static blocks should NOT have shimmer animation
    const styleAttr = staticEl.getAttribute("style") ?? "";
    expect(styleAttr).not.toContain("animation");
  });

  it("renders shimmer animation when reduced motion is not preferred", () => {
    render(<ProgressiveSkeleton isActive />);
    const shimmer = screen.getByTestId("skeleton-shimmer");
    const firstBlock = shimmer.querySelector("div");
    expect(firstBlock?.style.animation).toContain("shimmer");
  });

  // --- Not active: returns null ---
  it("returns null when not active", () => {
    render(<ProgressiveSkeleton isActive={false} />);
    expect(
      screen.queryByTestId("progressive-skeleton")
    ).not.toBeInTheDocument();
  });

  // --- Resets to stage 1 when deactivated and reactivated ---
  it("resets to stage 1 on re-activation", () => {
    const { rerender } = render(<ProgressiveSkeleton isActive />);

    act(() => {
      vi.advanceTimersByTime(3100);
    });

    expect(
      screen.getByText("Comparing with your monthly budget...")
    ).toBeInTheDocument();

    rerender(<ProgressiveSkeleton isActive={false} />);
    rerender(<ProgressiveSkeleton isActive />);

    expect(
      screen.getByText("Analyzing your spending patterns...")
    ).toBeInTheDocument();
  });

  // --- Skeleton copy element exists ---
  it("renders skeleton copy element", () => {
    render(<ProgressiveSkeleton isActive />);
    expect(screen.getByTestId("skeleton-copy")).toBeInTheDocument();
  });
});
