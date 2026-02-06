import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GuardianErrorFallback } from "./guardian-error-fallback";

// Mock Button to avoid pulling full UI component tree
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    size,
    variant,
  }: {
    children?: string;
    onClick?: () => void;
    size?: string;
    variant?: string;
  }) => (
    <button
      data-size={size}
      data-variant={variant}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  ),
}));

const MANUAL_UNLOCK_REGEX = /manual unlock/i;
const DISMISS_REGEX = /dismiss/i;

describe("GuardianErrorFallback", () => {
  it("renders 'Guardian unavailable' message", () => {
    render(<GuardianErrorFallback />);
    expect(
      screen.getByText("Guardian unavailable. You can unlock manually.")
    ).toBeInTheDocument();
  });

  it("renders Manual Unlock button", () => {
    render(<GuardianErrorFallback onManualUnlock={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: MANUAL_UNLOCK_REGEX })
    ).toBeInTheDocument();
  });

  it("calls onManualUnlock when Manual Unlock is clicked", async () => {
    const onManualUnlock = vi.fn();
    const user = userEvent.setup();
    render(<GuardianErrorFallback onManualUnlock={onManualUnlock} />);
    await user.click(screen.getByRole("button", { name: MANUAL_UNLOCK_REGEX }));
    expect(onManualUnlock).toHaveBeenCalledOnce();
  });

  it("renders Dismiss button only when onDismiss is provided", () => {
    const { rerender } = render(<GuardianErrorFallback />);
    expect(
      screen.queryByRole("button", { name: DISMISS_REGEX })
    ).not.toBeInTheDocument();

    rerender(<GuardianErrorFallback onDismiss={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: DISMISS_REGEX })
    ).toBeInTheDocument();
  });

  it("calls onDismiss when Dismiss is clicked", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<GuardianErrorFallback onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: DISMISS_REGEX }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("has aria-live='assertive' region for screen reader announcement", () => {
    render(<GuardianErrorFallback />);
    const message = screen.getByText(
      "Guardian unavailable. You can unlock manually."
    );
    const liveRegion = message.closest("[aria-live]");
    expect(liveRegion).toHaveAttribute("aria-live", "assertive");
  });

  it("uses neutral button styling (outline variant, not destructive)", () => {
    render(<GuardianErrorFallback onManualUnlock={vi.fn()} />);
    const button = screen.getByRole("button", { name: MANUAL_UNLOCK_REGEX });
    expect(button).toHaveAttribute("data-variant", "outline");
  });
});
