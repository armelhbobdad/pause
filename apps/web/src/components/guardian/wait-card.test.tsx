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
    expect(output).toHaveAttribute("aria-live", "polite");
  });

  it("disables Unlock Anyway button when disabled prop is true", () => {
    render(<WaitCard disabled output={makeOutput()} />);
    const unlockButton = screen.getByRole("button", { name: UNLOCK_RE });
    expect(unlockButton).toBeDisabled();
  });

  // --- Story 5.2 AC3: max-height constraint ---
  it("enforces max-height: 350px and overflow-y: auto on output wrapper (AC3)", () => {
    render(<WaitCard output={makeOutput()} />);
    const output = screen.getByRole("status");
    expect(output.style.maxHeight).toBe("350px");
    expect(output.style.overflowY).toBe("auto");
  });

  // --- Story 5.2 AC5: exact button aria-labels ---
  it('has aria-label="Sleep on this purchase decision" on sleep button (AC5)', () => {
    render(<WaitCard output={makeOutput()} />);
    expect(
      screen.getByLabelText("Sleep on this purchase decision")
    ).toBeInTheDocument();
  });

  it('has aria-label="Unlock card anyway" on unlock button (AC5)', () => {
    render(<WaitCard output={makeOutput()} />);
    expect(screen.getByLabelText("Unlock card anyway")).toBeInTheDocument();
  });
});
