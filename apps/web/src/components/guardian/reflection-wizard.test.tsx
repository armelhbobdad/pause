import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WizardResponse } from "@/lib/guardian/types";
import { ReflectionWizard } from "./reflection-wizard";

const NEXT_RE = /next/i;
const CLOSE_RE = /close/i;
const BORED_RE = /bored/i;
const EXCITED_RE = /excited/i;
const STRESSED_RE = /stressed/i;
const RESTLESS_RE = /restless/i;
const OTHER_RE = /other/i;
const WAIT_AND_REFLECT_RE = /wait and reflect/i;
const UNLOCK_CARD_ANYWAY_RE = /unlock card anyway/i;
const BOOKMARK_RE = /bookmark/i;

describe("ReflectionWizard", () => {
  const defaultProps = {
    onComplete: vi.fn() as (
      responses: WizardResponse[],
      outcome: "wait" | "override" | "wizard_bookmark"
    ) => void,
    onAbandon: vi.fn() as (lastCompletedStep: number) => void,
  };

  // ========================================================================
  // Step 1 — Trigger (free-text)
  // ========================================================================

  it("renders Step 1 initially", () => {
    render(<ReflectionWizard {...defaultProps} />);
    expect(
      screen.getByText("What prompted this purchase desire?")
    ).toBeInTheDocument();
  });

  it("shows progress indicator 'Step 1 of 3'", () => {
    render(<ReflectionWizard {...defaultProps} />);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("progress indicator has aria-valuenow and aria-valuemax", () => {
    render(<ReflectionWizard {...defaultProps} />);
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress).toHaveAttribute("aria-valuemax", "3");
  });

  it("has aria-label on the wizard container", () => {
    render(<ReflectionWizard {...defaultProps} />);
    expect(screen.getByRole("group")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Reflection wizard")
    );
  });

  it("Next button is present on Step 1", () => {
    render(<ReflectionWizard {...defaultProps} />);
    expect(screen.getByRole("button", { name: NEXT_RE })).toBeInTheDocument();
  });

  // ========================================================================
  // Step navigation
  // ========================================================================

  it("advances to Step 2 on Next click", async () => {
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "Saw it on Instagram");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    expect(
      screen.getByText("How are you feeling right now?")
    ).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
  });

  it("advances to Step 3 from Step 2", async () => {
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} />);

    // Step 1 → Step 2
    await user.type(screen.getByRole("textbox"), "Saw it on Instagram");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    // Step 2: select quick option → Step 3
    await user.click(screen.getByRole("radio", { name: BORED_RE }));
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    expect(
      screen.getByText("What else could address that feeling?")
    ).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
  });

  // ========================================================================
  // Step 2 — Feeling (quick-select)
  // ========================================================================

  it("renders quick-select radio options on Step 2", async () => {
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} />);

    await user.type(screen.getByRole("textbox"), "Saw it on Instagram");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    expect(screen.getByRole("radio", { name: EXCITED_RE })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: STRESSED_RE })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: BORED_RE })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: RESTLESS_RE })
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: OTHER_RE })).toBeInTheDocument();
  });

  it("selects a quick-select option", async () => {
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} />);

    await user.type(screen.getByRole("textbox"), "Saw it");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    const stressedRadio = screen.getByRole("radio", { name: STRESSED_RE });
    await user.click(stressedRadio);
    expect(stressedRadio).toBeChecked();
  });

  // ========================================================================
  // Free-text input capture
  // ========================================================================

  it("captures free-text input value on Step 1", async () => {
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "I saw it on TikTok");
    expect(input).toHaveValue("I saw it on TikTok");
  });

  // ========================================================================
  // Summary screen
  // ========================================================================

  it("renders summary after Step 3 completion", async () => {
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} />);

    // Step 1
    await user.type(screen.getByRole("textbox"), "Saw it on Instagram");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    // Step 2
    await user.click(screen.getByRole("radio", { name: BORED_RE }));
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    // Step 3
    await user.type(screen.getByRole("textbox"), "Go for a walk");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    // Summary
    expect(screen.getByText("Here's what you shared")).toBeInTheDocument();
    expect(screen.getByText("Saw it on Instagram")).toBeInTheDocument();
    expect(screen.getByText("Bored")).toBeInTheDocument();
    expect(screen.getByText("Go for a walk")).toBeInTheDocument();
  });

  // ========================================================================
  // Action buttons on Summary
  // ========================================================================

  it('"Wait & Reflect" fires onComplete with outcome "wait"', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} onComplete={onComplete} />);

    // Navigate through wizard
    await user.type(screen.getByRole("textbox"), "Saw it");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));
    await user.click(screen.getByRole("radio", { name: EXCITED_RE }));
    await user.click(screen.getByRole("button", { name: NEXT_RE }));
    await user.type(screen.getByRole("textbox"), "Go for a walk");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    await user.click(screen.getByRole("button", { name: WAIT_AND_REFLECT_RE }));

    expect(onComplete).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ step: 1, answer: "Saw it" }),
        expect.objectContaining({ step: 2, answer: "Excited" }),
        expect.objectContaining({ step: 3, answer: "Go for a walk" }),
      ]),
      "wait"
    );
  });

  it('"Unlock Anyway" fires onComplete with outcome "override"', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} onComplete={onComplete} />);

    // Navigate through wizard
    await user.type(screen.getByRole("textbox"), "Saw it");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));
    await user.click(screen.getByRole("radio", { name: BORED_RE }));
    await user.click(screen.getByRole("button", { name: NEXT_RE }));
    await user.type(screen.getByRole("textbox"), "Read a book");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    await user.click(
      screen.getByRole("button", { name: UNLOCK_CARD_ANYWAY_RE })
    );

    expect(onComplete).toHaveBeenCalledWith(expect.any(Array), "override");
  });

  it('"Bookmark" fires onComplete with outcome "wizard_bookmark"', async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} onComplete={onComplete} />);

    // Navigate through wizard
    await user.type(screen.getByRole("textbox"), "Saw it");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));
    await user.click(screen.getByRole("radio", { name: STRESSED_RE }));
    await user.click(screen.getByRole("button", { name: NEXT_RE }));
    await user.type(screen.getByRole("textbox"), "Take a nap");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));

    await user.click(screen.getByRole("button", { name: BOOKMARK_RE }));

    expect(onComplete).toHaveBeenCalledWith(
      expect.any(Array),
      "wizard_bookmark"
    );
  });

  // ========================================================================
  // Abandonment
  // ========================================================================

  it("close button fires onAbandon with lastCompletedStep 0 on Step 1", async () => {
    const onAbandon = vi.fn();
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} onAbandon={onAbandon} />);

    await user.click(screen.getByRole("button", { name: CLOSE_RE }));
    expect(onAbandon).toHaveBeenCalledWith(0);
  });

  it("close button fires onAbandon with lastCompletedStep 1 on Step 2", async () => {
    const onAbandon = vi.fn();
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} onAbandon={onAbandon} />);

    await user.type(screen.getByRole("textbox"), "Test");
    await user.click(screen.getByRole("button", { name: NEXT_RE }));
    await user.click(screen.getByRole("button", { name: CLOSE_RE }));

    expect(onAbandon).toHaveBeenCalledWith(1);
  });

  // ========================================================================
  // Character limit
  // ========================================================================

  it("free-text input has maxLength of 500", () => {
    render(<ReflectionWizard {...defaultProps} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("maxLength", "500");
  });

  it("displays character counter showing current length out of 500", async () => {
    const user = userEvent.setup();
    render(<ReflectionWizard {...defaultProps} />);

    expect(screen.getByText("0/500")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "Hello");
    expect(screen.getByText("5/500")).toBeInTheDocument();
  });
});
