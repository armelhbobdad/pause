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
      transition,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      animate?: unknown;
      transition?: unknown;
    }) => (
      <div
        data-animate={JSON.stringify(animate)}
        data-transition-duration={
          transition &&
          typeof transition === "object" &&
          "duration" in transition
            ? String((transition as { duration: number }).duration)
            : undefined
        }
        data-transition-repeat={
          transition && typeof transition === "object" && "repeat" in transition
            ? String((transition as { repeat: number }).repeat)
            : undefined
        }
        {...props}
      >
        {children}
      </div>
    ),
  },
  useReducedMotion: () => mockReducedMotion.current,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { CardVaultInner } from "./card-vault-inner";

function getAnimate(el: HTMLElement) {
  return JSON.parse(el.getAttribute("data-animate") || "{}");
}

describe("CardVaultInner", () => {
  beforeEach(() => {
    mockReducedMotion.current = false;
  });

  it("renders with data-guardian-state attribute", () => {
    render(<CardVaultInner guardianState="idle" />);
    const inner = screen.getByTestId("card-vault-inner");
    expect(inner).toHaveAttribute("data-guardian-state", "idle");
  });

  it("renders card face component", () => {
    render(<CardVaultInner guardianState="idle" />);
    expect(screen.getByTestId("card-face")).toBeInTheDocument();
  });

  it("renders blur overlay in blurred state for non-revealed states", () => {
    render(<CardVaultInner guardianState="idle" />);
    expect(screen.getByTestId("blur-overlay")).toBeInTheDocument();
  });

  // Idle state animation
  it("maps idle state to 4s breathing pulse animation", () => {
    render(<CardVaultInner guardianState="idle" />);
    const inner = screen.getByTestId("card-vault-inner");
    expect(inner.getAttribute("data-transition-duration")).toBe("4");
    expect(inner.getAttribute("data-transition-repeat")).toBe("Infinity");
  });

  it("maps idle state to scale oscillation (1 -> 1.02 -> 1)", () => {
    render(<CardVaultInner guardianState="idle" />);
    const inner = screen.getByTestId("card-vault-inner");
    const animate = getAnimate(inner);
    expect(animate.scale).toEqual([1, 1.02, 1]);
  });

  // Expanding state animation
  it("maps expanding state to 600ms outward ripple", () => {
    render(<CardVaultInner guardianState="expanding" />);
    const inner = screen.getByTestId("card-vault-inner");
    expect(inner.getAttribute("data-transition-duration")).toBe("0.6");
  });

  // Active state animation
  it("maps active state to 1200ms pulsing amber glow", () => {
    render(<CardVaultInner guardianState="active" />);
    const inner = screen.getByTestId("card-vault-inner");
    expect(inner.getAttribute("data-transition-duration")).toBe("1.2");
    expect(inner.getAttribute("data-transition-repeat")).toBe("Infinity");
  });

  it("maps active state to amber glow", () => {
    render(<CardVaultInner guardianState="active" />);
    const inner = screen.getByTestId("card-vault-inner");
    const animate = getAnimate(inner);
    expect(JSON.stringify(animate.boxShadow)).toContain("rgba(214, 180, 78");
  });

  // Collapsing state animation
  it("maps collapsing state to 400ms shrink animation", () => {
    render(<CardVaultInner guardianState="collapsing" />);
    const inner = screen.getByTestId("card-vault-inner");
    expect(inner.getAttribute("data-transition-duration")).toBe("0.4");
  });

  it("maps collapsing state to scale shrink (1 -> 0.98 -> 1)", () => {
    render(<CardVaultInner guardianState="collapsing" />);
    const inner = screen.getByTestId("card-vault-inner");
    const animate = getAnimate(inner);
    expect(animate.scale).toEqual([1, 0.98, 1]);
  });

  // Revealed state
  it("maps revealed state to success glow", () => {
    render(<CardVaultInner guardianState="revealed" />);
    const inner = screen.getByTestId("card-vault-inner");
    const animate = getAnimate(inner);
    expect(JSON.stringify(animate.boxShadow)).toContain("rgba(48, 162, 76");
  });

  // Reduced motion
  it("shows static subtle glow for idle with reduced motion", () => {
    mockReducedMotion.current = true;
    render(<CardVaultInner guardianState="idle" />);
    const inner = screen.getByTestId("card-vault-inner");
    const animate = getAnimate(inner);
    expect(animate.scale).toBe(1);
    expect(animate.boxShadow).toContain("rgba(200, 210, 230");
  });

  it("uses instant crossfade (150ms) with reduced motion", () => {
    mockReducedMotion.current = true;
    render(<CardVaultInner guardianState="expanding" />);
    const inner = screen.getByTestId("card-vault-inner");
    expect(inner.getAttribute("data-transition-duration")).toBe("0.15");
  });

  it("hides blur overlay (clear state) for revealed + reduced motion", () => {
    mockReducedMotion.current = true;
    render(<CardVaultInner guardianState="revealed" />);
    // BlurOverlay should be in "clear" state (not rendered)
    expect(screen.queryByTestId("blur-overlay")).not.toBeInTheDocument();
  });
});
