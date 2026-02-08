import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      layout,
      onLayoutAnimationComplete,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      layout?: string;
      onLayoutAnimationComplete?: () => void;
    }) => (
      <div data-layout={layout} {...props}>
        {children}
      </div>
    ),
  },
  useReducedMotion: () => false,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { CardVaultWrapper } from "./card-vault-wrapper";

describe("CardVaultWrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ARIA attributes (AC#9)
  it("renders with role='button'", () => {
    render(<CardVaultWrapper guardianState="idle" />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    expect(wrapper).toHaveAttribute("role", "button");
  });

  it("renders with tabIndex={0}", () => {
    render(<CardVaultWrapper guardianState="idle" />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    expect(wrapper).toHaveAttribute("tabindex", "0");
  });

  it("renders with correct aria-label", () => {
    render(<CardVaultWrapper guardianState="idle" />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    expect(wrapper).toHaveAttribute(
      "aria-label",
      "Card Vault — tap to start Guardian flow"
    );
  });

  // Layout (AC#1)
  it("uses layout='position' for Framer Motion", () => {
    render(<CardVaultWrapper guardianState="idle" />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    expect(wrapper).toHaveAttribute("data-layout", "position");
  });

  // Overflow (AC#7)
  it("has overflow: hidden to contain breathing glow", () => {
    render(<CardVaultWrapper guardianState="idle" />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    expect(wrapper.style.overflow).toBe("hidden");
  });

  // Keyboard activation (AC#9) — use fireEvent to avoid userEvent timer conflicts
  it("activates guardian flow on Enter key", () => {
    const onActivate = vi.fn();
    render(<CardVaultWrapper guardianState="idle" onActivate={onActivate} />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    fireEvent.keyDown(wrapper, { key: "Enter" });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("activates guardian flow on Space key", () => {
    const onActivate = vi.fn();
    render(<CardVaultWrapper guardianState="idle" onActivate={onActivate} />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    fireEvent.keyDown(wrapper, { key: " " });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  // Click activation
  it("activates guardian flow on click", () => {
    const onActivate = vi.fn();
    render(<CardVaultWrapper guardianState="idle" onActivate={onActivate} />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    fireEvent.click(wrapper);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  // Debounce (AC#6)
  it("debounces rapid taps with 50ms delay", () => {
    const onActivate = vi.fn();
    render(<CardVaultWrapper guardianState="idle" onActivate={onActivate} />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    // Rapid double-click
    fireEvent.click(wrapper);
    fireEvent.click(wrapper);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    // Should only fire once (second click ignored because timer is pending)
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  // State guard
  it("does not activate when not in idle state", () => {
    const onActivate = vi.fn();
    render(<CardVaultWrapper guardianState="active" onActivate={onActivate} />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    fireEvent.click(wrapper);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(onActivate).not.toHaveBeenCalled();
  });

  // Renders inner component
  it("renders CardVaultInner inside", () => {
    render(<CardVaultWrapper guardianState="idle" />);
    expect(screen.getByTestId("card-vault-inner")).toBeInTheDocument();
  });

  // Focus visible styling
  it("includes focus-visible ring class", () => {
    render(<CardVaultWrapper guardianState="idle" />);
    const wrapper = screen.getByTestId("card-vault-wrapper");
    expect(wrapper.className).toContain("focus-visible:ring-2");
  });
});
