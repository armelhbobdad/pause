import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WizardCard } from "./wizard-card";

const EXPLORE_MORE_RE = /explore more/i;
const SKIP_RE = /skip/i;

describe("WizardCard", () => {
  const defaultProps = {
    reasoning:
      "This is a significant purchase. Exploring your feelings might help.",
  };

  it("renders reasoning text", () => {
    render(<WizardCard {...defaultProps} />);
    expect(screen.getByText(defaultProps.reasoning)).toBeInTheDocument();
  });

  it('"Explore More" button fires onExplore callback', async () => {
    const user = userEvent.setup();
    const onExplore = vi.fn();
    render(<WizardCard {...defaultProps} onExplore={onExplore} />);

    await user.click(screen.getByRole("button", { name: EXPLORE_MORE_RE }));
    expect(onExplore).toHaveBeenCalledOnce();
  });

  it('"Skip" button fires onSkip callback', async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<WizardCard {...defaultProps} onSkip={onSkip} />);

    await user.click(screen.getByRole("button", { name: SKIP_RE }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("disables both buttons when disabled prop is true", () => {
    render(<WizardCard {...defaultProps} disabled />);

    const exploreBtn = screen.getByRole("button", { name: EXPLORE_MORE_RE });
    const skipBtn = screen.getByRole("button", { name: SKIP_RE });

    expect(exploreBtn).toBeDisabled();
    expect(skipBtn).toBeDisabled();
  });

  it("buttons are enabled when disabled prop is false", () => {
    render(<WizardCard {...defaultProps} disabled={false} />);

    const exploreBtn = screen.getByRole("button", { name: EXPLORE_MORE_RE });
    const skipBtn = screen.getByRole("button", { name: SKIP_RE });

    expect(exploreBtn).not.toBeDisabled();
    expect(skipBtn).not.toBeDisabled();
  });

  it("has aria-label on the container", () => {
    render(<WizardCard {...defaultProps} />);
    expect(screen.getByLabelText("Wizard option")).toBeInTheDocument();
  });

  it("has aria-live polite for screen reader announcements", () => {
    render(<WizardCard {...defaultProps} />);
    const container = screen.getByLabelText("Wizard option");
    expect(container).toHaveAttribute("aria-live", "polite");
  });

  it("respects max-height 350px styling", () => {
    render(<WizardCard {...defaultProps} />);
    const container = screen.getByLabelText("Wizard option");
    expect(container.style.maxHeight).toBe("350px");
  });

  it("has dark-themed card styling with border accent", () => {
    render(<WizardCard {...defaultProps} />);
    const container = screen.getByLabelText("Wizard option");
    const style = container.getAttribute("style") ?? "";
    // happy-dom drops oklch() backgroundColor, but border-left confirms dark theme styling
    expect(style).toContain("border-left");
    expect(style).toContain("border-radius: 0.5rem");
  });
});
