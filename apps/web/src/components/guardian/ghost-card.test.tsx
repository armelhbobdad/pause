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

  it("hides buttons in feedback_given state", () => {
    render(<GhostCard {...makeProps({ state: "feedback_given" })} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});
