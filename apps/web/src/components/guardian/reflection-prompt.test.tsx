import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReflectionPrompt } from "./reflection-prompt";

const UNLOCK_RE = /unlock/i;
const WAIT_RE = /wait/i;

function makeOutput() {
  return {
    strategyId: "future_self",
    reflectionPrompt: "What would tomorrow-you think about this one?",
    strategyName: "Future-Self Visualization",
  };
}

describe("ReflectionPrompt", () => {
  it("renders reflection question text", () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    expect(
      screen.getByText("What would tomorrow-you think about this one?")
    ).toBeInTheDocument();
  });

  it("renders strategy name label", () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    expect(screen.getByText("Future-Self Visualization")).toBeInTheDocument();
  });

  it('"Unlock Anyway" button calls onOverride', async () => {
    const user = userEvent.setup();
    const mockOverride = vi.fn();
    render(
      <ReflectionPrompt onOverride={mockOverride} output={makeOutput()} />
    );

    await user.click(screen.getByRole("button", { name: UNLOCK_RE }));
    expect(mockOverride).toHaveBeenCalledOnce();
  });

  it("has correct aria attributes", () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    const output = screen.getByRole("status");
    expect(output).toHaveAttribute("aria-label", "Reflection question");
    expect(output).toHaveAttribute("aria-live", "polite");
  });

  it("uses therapist amber color on reflection text", () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    const text = screen.getByText(
      "What would tomorrow-you think about this one?"
    );
    expect(text.style.color).toBe("var(--therapist-amber)");
  });

  it("disables Unlock Anyway button when disabled prop is true", () => {
    render(<ReflectionPrompt disabled output={makeOutput()} />);
    const button = screen.getByRole("button", { name: UNLOCK_RE });
    expect(button).toBeDisabled();
  });

  it('"Wait & Reflect" button is enabled by default', () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    const waitButton = screen.getByRole("button", { name: WAIT_RE });
    expect(waitButton).toBeInTheDocument();
    expect(waitButton).toBeEnabled();
  });

  it('"Wait & Reflect" button calls onWait', async () => {
    const user = userEvent.setup();
    const mockWait = vi.fn();
    render(<ReflectionPrompt onWait={mockWait} output={makeOutput()} />);

    await user.click(screen.getByRole("button", { name: WAIT_RE }));
    expect(mockWait).toHaveBeenCalledOnce();
  });

  it("disables Wait & Reflect button when disabled prop is true", () => {
    render(<ReflectionPrompt disabled output={makeOutput()} />);
    const waitButton = screen.getByRole("button", { name: WAIT_RE });
    expect(waitButton).toBeDisabled();
  });

  // --- Story 5.2 AC3: max-height constraint ---
  it("enforces max-height: 350px and overflow-y: auto on output wrapper (AC3)", () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    const output = screen.getByRole("status");
    expect(output.style.maxHeight).toBe("350px");
    expect(output.style.overflowY).toBe("auto");
  });

  // --- Story 5.2 AC4: amber color on border ---
  it("uses --therapist-amber on border-left (AC4)", () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    const output = screen.getByRole("status");
    // happy-dom decomposes shorthand borderLeft into individual properties
    expect(output.style.borderLeftColor).toBe("var(--therapist-amber)");
  });

  // --- Story 5.2 AC4: amber-subtle background ---
  it("uses --therapist-amber-subtle for background (AC4)", () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    const output = screen.getByRole("status");
    expect(output.style.backgroundColor).toBe("var(--therapist-amber-subtle)");
  });

  // --- Story 5.2 AC5: exact button aria-labels ---
  it('has aria-label="Wait and reflect on this purchase" on wait button (AC5)', () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    expect(
      screen.getByLabelText("Wait and reflect on this purchase")
    ).toBeInTheDocument();
  });

  it('has aria-label="Unlock card anyway" on unlock button (AC5)', () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    expect(screen.getByLabelText("Unlock card anyway")).toBeInTheDocument();
  });
});
