import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WaitCard } from "./wait-card";

const SLEEP_RE = /sleep/i;
const UNLOCK_RE = /unlock/i;

function makeOutput() {
  return {
    durationHours: 24,
    reasoning: "Sleeping on it often brings clarity",
  };
}

describe("WaitCard", () => {
  it("renders wait reasoning text", () => {
    render(<WaitCard output={makeOutput()} />);
    expect(
      screen.getByText("Sleeping on it often brings clarity")
    ).toBeInTheDocument();
  });

  it('renders "Sleep on it" button (disabled)', () => {
    render(<WaitCard output={makeOutput()} />);
    const sleepButton = screen.getByRole("button", { name: SLEEP_RE });
    expect(sleepButton).toBeInTheDocument();
    expect(sleepButton).toBeDisabled();
  });

  it('"Unlock Anyway" button calls onOverride', async () => {
    const user = userEvent.setup();
    const mockOverride = vi.fn();
    render(<WaitCard onOverride={mockOverride} output={makeOutput()} />);

    await user.click(screen.getByRole("button", { name: UNLOCK_RE }));
    expect(mockOverride).toHaveBeenCalledOnce();
  });

  it("has correct aria attributes", () => {
    render(<WaitCard output={makeOutput()} />);
    const output = screen.getByRole("status");
    expect(output).toHaveAttribute("aria-label", "Wait option");
  });

  it("disables Unlock Anyway button when disabled prop is true", () => {
    render(<WaitCard disabled output={makeOutput()} />);
    const unlockButton = screen.getByRole("button", { name: UNLOCK_RE });
    expect(unlockButton).toBeDisabled();
  });
});
