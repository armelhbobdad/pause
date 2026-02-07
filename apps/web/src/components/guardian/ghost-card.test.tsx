import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GhostCardProps } from "./ghost-card";
import { GhostCard } from "./ghost-card";

// --- IntersectionObserver mock ---
let observerCallback: IntersectionObserverCallback;
let observerInstance: {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  observerInstance = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  };

  vi.stubGlobal(
    "IntersectionObserver",
    class MockIntersectionObserver {
      observe = observerInstance.observe;
      disconnect = observerInstance.disconnect;
      unobserve = observerInstance.unobserve;
      root = null;
      rootMargin = "";
      thresholds = [0];
      takeRecords = () => [];
      constructor(cb: IntersectionObserverCallback) {
        observerCallback = cb;
      }
    }
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeProps(overrides: Partial<GhostCardProps> = {}): GhostCardProps {
  return {
    id: "ghost-1",
    state: "revealed",
    recall: "Those $180 headphones from Tuesday — still using them daily?",
    data: "$180.00 · BestBuy · Tuesday 3:42 PM",
    tierOrigin: "negotiator",
    satisfactionFeedback: null,
    ...overrides,
  };
}

describe("GhostCard", () => {
  // ========================================================================
  // Frosted State (AC3)
  // ========================================================================

  it("renders frosted state with blur filter and reduced opacity", () => {
    render(<GhostCard {...makeProps({ state: "frosted" })} />);

    const article = screen.getByRole("article");
    expect(article.style.filter).toBe("blur(var(--frost-blur))");
    expect(article.style.opacity).toBe("0.7");
  });

  // ========================================================================
  // Revealed State (AC5)
  // ========================================================================

  it("renders revealed state with no blur", () => {
    render(<GhostCard {...makeProps({ state: "revealed" })} />);

    const article = screen.getByRole("article");
    expect(article.style.filter).toBe("blur(0px)");
    expect(article.style.opacity).toBe("1");
  });

  it("renders recall, data, and learning lines", () => {
    render(
      <GhostCard
        {...makeProps({
          learning: "You tend to buy electronics impulsively on weekdays",
        })}
      />
    );

    expect(
      screen.getByText(
        "Those $180 headphones from Tuesday — still using them daily?"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("$180.00 · BestBuy · Tuesday 3:42 PM")
    ).toBeInTheDocument();
    expect(
      screen.getByText("You tend to buy electronics impulsively on weekdays")
    ).toBeInTheDocument();
  });

  // ========================================================================
  // De-Frost via IntersectionObserver (AC4)
  // ========================================================================

  it("triggers onDefrost when IntersectionObserver fires", () => {
    const onDefrost = vi.fn();
    render(<GhostCard {...makeProps({ state: "frosted", onDefrost })} />);

    expect(observerInstance.observe).toHaveBeenCalled();

    // Simulate intersection
    observerCallback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observerInstance as unknown as IntersectionObserver
    );

    expect(onDefrost).toHaveBeenCalledOnce();
    expect(observerInstance.disconnect).toHaveBeenCalled();
  });

  // ========================================================================
  // Observer cleanup on unmount (AC10)
  // ========================================================================

  it("disconnects IntersectionObserver on unmount", () => {
    const { unmount } = render(
      <GhostCard {...makeProps({ state: "frosted" })} />
    );

    expect(observerInstance.observe).toHaveBeenCalled();

    unmount();
    expect(observerInstance.disconnect).toHaveBeenCalled();
  });

  // ========================================================================
  // Feedback Buttons — Tier-Specific (AC7)
  // ========================================================================

  it("renders negotiator buttons: 'Worth it' / 'Regret it'", () => {
    render(
      <GhostCard
        {...makeProps({ tierOrigin: "negotiator", state: "revealed" })}
      />
    );

    expect(screen.getByText("Worth it")).toBeInTheDocument();
    expect(screen.getByText("Regret it")).toBeInTheDocument();
  });

  it("renders therapist buttons: 'Good question' / 'Not helpful'", () => {
    render(
      <GhostCard
        {...makeProps({ tierOrigin: "therapist", state: "revealed" })}
      />
    );

    expect(screen.getByText("Good question")).toBeInTheDocument();
    expect(screen.getByText("Not helpful")).toBeInTheDocument();
  });

  it("renders no buttons for override tier", () => {
    render(
      <GhostCard
        {...makeProps({ tierOrigin: "override", state: "revealed" })}
      />
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("calls onFeedback with 'positive' when positive button clicked", async () => {
    const onFeedback = vi.fn();
    render(<GhostCard {...makeProps({ state: "revealed", onFeedback })} />);

    await userEvent.click(screen.getByText("Worth it"));
    expect(onFeedback).toHaveBeenCalledWith("positive");
  });

  it("calls onFeedback with 'negative' when negative button clicked", async () => {
    const onFeedback = vi.fn();
    render(<GhostCard {...makeProps({ state: "revealed", onFeedback })} />);

    await userEvent.click(screen.getByText("Regret it"));
    expect(onFeedback).toHaveBeenCalledWith("negative");
  });

  // ========================================================================
  // Sensitive Category Filtering (AC6)
  // ========================================================================

  it("suppresses card for alcohol category", () => {
    const { container } = render(
      <GhostCard {...makeProps({ category: "alcohol" })} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("suppresses card for gambling category", () => {
    const { container } = render(
      <GhostCard {...makeProps({ category: "gambling" })} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("suppresses card for pharmacy category (case-insensitive)", () => {
    const { container } = render(
      <GhostCard {...makeProps({ category: "Pharmacy" })} />
    );
    expect(container.innerHTML).toBe("");
  });

  // ========================================================================
  // Incomplete Data Suppression (AC6)
  // ========================================================================

  it("suppresses card when recall is empty", () => {
    const { container } = render(<GhostCard {...makeProps({ recall: "" })} />);
    expect(container.innerHTML).toBe("");
  });

  it("suppresses card when data is empty", () => {
    const { container } = render(<GhostCard {...makeProps({ data: "" })} />);
    expect(container.innerHTML).toBe("");
  });

  // ========================================================================
  // Accessibility (AC3)
  // ========================================================================

  it("uses semantic article element with aria-label", () => {
    render(<GhostCard {...makeProps()} />);

    const article = screen.getByRole("article");
    expect(article.tagName).toBe("ARTICLE");
    expect(article.getAttribute("aria-label")).toBe(
      "Past spending: Those $180 headphones from Tuesday — still using them daily?"
    );
  });

  // ========================================================================
  // Feedback Given State
  // ========================================================================

  it("hides feedback buttons when satisfaction feedback is set", () => {
    render(
      <GhostCard
        {...makeProps({
          state: "feedback_given",
          satisfactionFeedback: "worth_it",
        })}
      />
    );

    expect(screen.queryByText("Worth it")).toBeNull();
    expect(screen.queryByText("Not sure")).toBeNull();
    expect(screen.queryByText("Regret it")).toBeNull();
  });

  it("shows buttons in feedback_given state when satisfactionFeedback is null (legacy)", () => {
    render(
      <GhostCard
        {...makeProps({ state: "feedback_given", satisfactionFeedback: null })}
      />
    );

    expect(screen.getByText("Worth it")).toBeInTheDocument();
  });

  // ========================================================================
  // Story 6.5: Satisfaction Feedback — "Not sure" button (AC1)
  // ========================================================================

  it("renders 'Not sure' button alongside positive/negative buttons", () => {
    render(<GhostCard {...makeProps({ state: "revealed" })} />);

    expect(screen.getByText("Not sure")).toBeInTheDocument();
    expect(screen.getByText("Worth it")).toBeInTheDocument();
    expect(screen.getByText("Regret it")).toBeInTheDocument();
  });

  // ========================================================================
  // Story 6.5: Feedback callbacks fire correct values (AC2, AC3, AC4)
  // ========================================================================

  it("calls onFeedback with 'skip' when 'Not sure' clicked", async () => {
    const onFeedback = vi.fn();
    render(<GhostCard {...makeProps({ state: "revealed", onFeedback })} />);

    await userEvent.click(screen.getByText("Not sure"));
    expect(onFeedback).toHaveBeenCalledWith("skip");
  });

  it("calls onSatisfactionFeedback with 'worth_it' for positive click", async () => {
    const onSatisfactionFeedback = vi.fn();
    render(
      <GhostCard
        {...makeProps({ state: "revealed", onSatisfactionFeedback })}
      />
    );

    await userEvent.click(screen.getByText("Worth it"));
    expect(onSatisfactionFeedback).toHaveBeenCalledWith("worth_it");
  });

  it("calls onSatisfactionFeedback with 'regret_it' for negative click", async () => {
    const onSatisfactionFeedback = vi.fn();
    render(
      <GhostCard
        {...makeProps({ state: "revealed", onSatisfactionFeedback })}
      />
    );

    await userEvent.click(screen.getByText("Regret it"));
    expect(onSatisfactionFeedback).toHaveBeenCalledWith("regret_it");
  });

  it("calls onSatisfactionFeedback with 'not_sure' for skip click", async () => {
    const onSatisfactionFeedback = vi.fn();
    render(
      <GhostCard
        {...makeProps({ state: "revealed", onSatisfactionFeedback })}
      />
    );

    await userEvent.click(screen.getByText("Not sure"));
    expect(onSatisfactionFeedback).toHaveBeenCalledWith("not_sure");
  });

  // ========================================================================
  // Story 6.5: SatisfactionDisplay — recorded text (AC5)
  // ========================================================================

  it("shows 'You said: Worth it' when satisfactionFeedback is worth_it", () => {
    render(
      <GhostCard
        {...makeProps({
          state: "feedback_given",
          satisfactionFeedback: "worth_it",
        })}
      />
    );

    expect(screen.getByText("You said: Worth it")).toBeInTheDocument();
  });

  it("shows empathetic message when satisfactionFeedback is regret_it", () => {
    render(
      <GhostCard
        {...makeProps({
          state: "feedback_given",
          satisfactionFeedback: "regret_it",
        })}
      />
    );

    expect(
      screen.getByText("Thanks for sharing. This helps your Guardian learn.")
    ).toBeInTheDocument();
  });

  it("shows neutral message when satisfactionFeedback is not_sure", () => {
    render(
      <GhostCard
        {...makeProps({
          state: "feedback_given",
          satisfactionFeedback: "not_sure",
        })}
      />
    );

    expect(
      screen.getByText("Got it. You can always change your mind later.")
    ).toBeInTheDocument();
  });

  // ========================================================================
  // Story 6.5: "Change" button triggers re-entry (AC6)
  // ========================================================================

  it("shows 'Change' button when satisfaction feedback is set", () => {
    render(
      <GhostCard
        {...makeProps({
          state: "feedback_given",
          satisfactionFeedback: "worth_it",
        })}
      />
    );

    expect(screen.getByText("Change")).toBeInTheDocument();
  });

  it("'Change' button is styled as link with aria-label", () => {
    render(
      <GhostCard
        {...makeProps({
          state: "feedback_given",
          satisfactionFeedback: "worth_it",
        })}
      />
    );

    const changeBtn = screen.getByText("Change");
    expect(changeBtn.tagName).toBe("BUTTON");
    expect(changeBtn.getAttribute("aria-label")).toBe(
      "Change satisfaction feedback"
    );
    expect(changeBtn.style.textDecoration).toBe("underline");
  });

  it("calls onSatisfactionFeedback with null when 'Change' clicked", async () => {
    const onSatisfactionFeedback = vi.fn();
    render(
      <GhostCard
        {...makeProps({
          state: "feedback_given",
          satisfactionFeedback: "worth_it",
          onSatisfactionFeedback,
        })}
      />
    );

    await userEvent.click(screen.getByText("Change"));
    expect(onSatisfactionFeedback).toHaveBeenCalledWith(null);
  });

  // ========================================================================
  // Story 6.5: Tier-specific labels preserved (AC1)
  // ========================================================================

  it("renders therapist 'Not sure' button alongside tier labels", () => {
    render(
      <GhostCard
        {...makeProps({ tierOrigin: "therapist", state: "revealed" })}
      />
    );

    expect(screen.getByText("Good question")).toBeInTheDocument();
    expect(screen.getByText("Not sure")).toBeInTheDocument();
    expect(screen.getByText("Not helpful")).toBeInTheDocument();
  });

  // ========================================================================
  // Story 6.5: isSubmitting disables buttons (AC2)
  // ========================================================================

  it("disables all buttons when isSubmitting is true", () => {
    render(
      <GhostCard {...makeProps({ state: "revealed", isSubmitting: true })} />
    );

    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      expect(button).toBeDisabled();
    }
  });

  // ========================================================================
  // Story 6.5: Accessibility — keyboard workflow (AC2)
  // ========================================================================

  it("allows keyboard-only Tab + Enter on feedback buttons", async () => {
    const onFeedback = vi.fn();
    render(<GhostCard {...makeProps({ state: "revealed", onFeedback })} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    // Focus first button directly and press Enter
    buttons[0].focus();
    await userEvent.keyboard("{Enter}");
    expect(onFeedback).toHaveBeenCalledWith("positive");
  });

  it("'Change' button has accessible aria-label", () => {
    render(
      <GhostCard
        {...makeProps({
          state: "feedback_given",
          satisfactionFeedback: "regret_it",
        })}
      />
    );

    const changeBtn = screen.getByLabelText("Change satisfaction feedback");
    expect(changeBtn).toBeInTheDocument();
    expect(changeBtn.tagName).toBe("BUTTON");
  });
});
