import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockReducedMotion = vi.hoisted(() => vi.fn(() => false));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: mockReducedMotion,
    motion: {
      ...actual.motion,
      div: "div" as unknown as typeof actual.motion.div,
      span: "span" as unknown as typeof actual.motion.span,
    },
  };
});

import { NativeBadge } from "./native-badge-carbon";
import { NativeButton } from "./native-button-shadcnui";

describe("NativeButton (Story 10.1)", () => {
  it("renders children", () => {
    render(<NativeButton>Click me</NativeButton>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("renders with loading prop", () => {
    render(<NativeButton loading>Loading</NativeButton>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });

  it("renders with glow prop without errors", () => {
    render(<NativeButton glow>Glow</NativeButton>);
    expect(screen.getByText("Glow")).toBeInTheDocument();
  });

  it("respects useReducedMotion", () => {
    mockReducedMotion.mockReturnValue(true);
    render(<NativeButton loading>Motion</NativeButton>);
    expect(screen.getByText("Motion")).toBeInTheDocument();
    mockReducedMotion.mockReturnValue(false);
  });

  it("disables button when disabled prop is set", () => {
    render(<NativeButton disabled>Disabled</NativeButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("NativeBadge (Story 10.1)", () => {
  it("renders in dark mode without errors", () => {
    document.documentElement.classList.add("dark");
    render(<NativeBadge>DEMO</NativeBadge>);
    expect(screen.getByText("DEMO")).toBeInTheDocument();
    document.documentElement.classList.remove("dark");
  });

  it("renders with glass variant", () => {
    render(<NativeBadge variant="glass">Glass</NativeBadge>);
    expect(screen.getByText("Glass")).toBeInTheDocument();
  });

  it("renders with animated variant and tag", () => {
    render(
      <NativeBadge tag="beta" variant="animated">
        Feature
      </NativeBadge>
    );
    expect(screen.getByText("Feature")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
  });

  it("renders different sizes", () => {
    const { rerender } = render(<NativeBadge size="sm">Small</NativeBadge>);
    expect(screen.getByText("Small")).toBeInTheDocument();

    rerender(<NativeBadge size="lg">Large</NativeBadge>);
    expect(screen.getByText("Large")).toBeInTheDocument();
  });
});
