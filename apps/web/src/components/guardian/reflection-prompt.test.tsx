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

  it('renders disabled "Wait & Reflect" placeholder button', () => {
    render(<ReflectionPrompt output={makeOutput()} />);
    const waitButton = screen.getByRole("button", { name: WAIT_RE });
    expect(waitButton).toBeInTheDocument();
    expect(waitButton).toBeDisabled();
    expect(waitButton).toHaveAttribute("title", "Coming soon");
  });
});
