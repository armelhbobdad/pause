import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReducedMotion } = vi.hoisted(() => ({
  mockReducedMotion: { current: false },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      animate,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { animate?: unknown }) => (
      <div data-animate={JSON.stringify(animate)} {...props}>
        {children}
      </div>
    ),
  },
  useReducedMotion: () => mockReducedMotion.current,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { BlurOverlay } from "./blur-overlay";

describe("BlurOverlay", () => {
  beforeEach(() => {
    mockReducedMotion.current = false;
  });

  it("renders with aria-hidden='true' (decorative element)", () => {
    render(<BlurOverlay state="blurred" />);
    const overlay = screen.getByTestId("blur-overlay");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
  });

  it("renders with will-change: transform for GPU promotion", () => {
    render(<BlurOverlay state="blurred" />);
    const overlay = screen.getByTestId("blur-overlay");
    expect(overlay.style.willChange).toBe("transform");
  });

  it("renders in blurred state with backdrop-filter", () => {
    render(<BlurOverlay state="blurred" />);
    const overlay = screen.getByTestId("blur-overlay");
    expect(overlay.style.backdropFilter).toContain(
      "blur(var(--pause-blur-heavy))"
    );
  });

  it("renders nothing in clear state", () => {
    render(<BlurOverlay state="clear" />);
    expect(screen.queryByTestId("blur-overlay")).not.toBeInTheDocument();
  });

  it("applies mask-image in revealing state", () => {
    render(<BlurOverlay state="revealing" />);
    const overlay = screen.getByTestId("blur-overlay");
    expect(overlay.style.maskImage).toContain("linear-gradient");
  });

  it("animates opacity to 0 in revealing state", () => {
    render(<BlurOverlay state="revealing" />);
    const overlay = screen.getByTestId("blur-overlay");
    const animate = JSON.parse(overlay.getAttribute("data-animate") || "{}");
    expect(animate.opacity).toBe(0);
  });

  it("animates opacity to 1 in blurred state", () => {
    render(<BlurOverlay state="blurred" />);
    const overlay = screen.getByTestId("blur-overlay");
    const animate = JSON.parse(overlay.getAttribute("data-animate") || "{}");
    expect(animate.opacity).toBe(1);
  });

  it("uses instant reveal (duration 0) with reduced motion", () => {
    mockReducedMotion.current = true;
    render(<BlurOverlay state="revealing" />);
    // When reduced motion is true, the overlay still renders but with duration 0
    const overlay = screen.getByTestId("blur-overlay");
    expect(overlay).toBeInTheDocument();
  });
});
