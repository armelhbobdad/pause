import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock framer-motion
const { mockUseReducedMotion } = vi.hoisted(() => ({
  mockUseReducedMotion: vi.fn(() => false),
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: mockUseReducedMotion,
}));

import { CelebrationOverlay } from "./celebration-overlay";

function defaultProps() {
  return {
    revealType: "earned" as const,
    amountCents: 1250,
    pauseDurationSeconds: 15,
    mindfulDays: 3,
    onDismiss: vi.fn(),
  };
}

describe("CelebrationOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseReducedMotion.mockReturnValue(false);
    // Mock requestAnimationFrame for counter animation
    let rafId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafId += 1;
      // Execute callback synchronously with a future timestamp
      setTimeout(() => cb(performance.now() + 1000), 0);
      return rafId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
      /* noop for test */
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --- AC#1: Confetti particles ---
  it("renders 30 confetti particles with aria-hidden on earned reveal", () => {
    render(<CelebrationOverlay {...defaultProps()} />);

    const particles = screen
      .getAllByTestId("celebration-overlay")
      .flatMap((el) => [...el.querySelectorAll("[data-confetti]")]);

    expect(particles).toHaveLength(30);
  });

  it("marks confetti container as aria-hidden", () => {
    render(<CelebrationOverlay {...defaultProps()} />);
    const container = screen
      .getByTestId("celebration-overlay")
      .querySelector("[aria-hidden='true']");
    expect(container).toBeInTheDocument();
  });

  // --- AC#1: Savings counter ---
  it("renders savings counter with tabular-nums", () => {
    render(<CelebrationOverlay {...defaultProps()} />);
    const counter = screen.getByTestId("savings-counter");
    expect(counter.style.fontVariantNumeric).toBe("tabular-nums");
  });

  // --- AC#2: 3s minimum display enforced ---
  it("does not show dismiss button before 3s", () => {
    render(<CelebrationOverlay {...defaultProps()} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByTestId("dismiss-button")).not.toBeInTheDocument();
  });

  it("shows dismiss button after 3s", () => {
    render(<CelebrationOverlay {...defaultProps()} />);
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.getByTestId("dismiss-button")).toBeInTheDocument();
  });

  // --- AC#2: visibilityState pauses timer ---
  it("pauses timer when tab is hidden", () => {
    // Start with visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });

    render(<CelebrationOverlay {...defaultProps()} />);

    // Advance 1.5s
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Tab becomes hidden
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // Advance 3s while hidden — timer should not progress
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByTestId("dismiss-button")).not.toBeInTheDocument();

    // Tab becomes visible again
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    // Advance remaining 2s
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("dismiss-button")).toBeInTheDocument();
  });

  // --- AC#3: Back to Dashboard dispatches RELOCK ---
  it("calls onDismiss when Back to Dashboard is clicked", () => {
    const props = defaultProps();
    render(<CelebrationOverlay {...props} />);

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    fireEvent.click(screen.getByTestId("dismiss-button"));
    expect(props.onDismiss).toHaveBeenCalledOnce();
  });

  // --- AC#4: Earned variant shows confetti + green accent ---
  it("earned variant uses --pause-success accent color", () => {
    render(<CelebrationOverlay {...defaultProps()} />);
    // The dismiss button (when shown) uses the accent color
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    const btn = screen.getByTestId("dismiss-button");
    expect(btn.style.backgroundColor).toBe("var(--pause-success)");
  });

  // --- AC#4: Wait-expired variant has no confetti ---
  it("wait-expired variant does not render confetti", () => {
    const props = { ...defaultProps(), revealType: "wait-expired" as const };
    render(<CelebrationOverlay {...props} />);

    const overlay = screen.getByTestId("celebration-overlay");
    const particles = overlay.querySelectorAll("[data-confetti]");
    expect(particles).toHaveLength(0);
  });

  // --- AC#4: Reduced motion shows static "Saved!" badge ---
  it("shows static Saved! badge when reduced motion is preferred", () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<CelebrationOverlay {...defaultProps()} />);
    expect(screen.getByTestId("static-saved-badge")).toBeInTheDocument();
    expect(screen.getByText("Saved!")).toBeInTheDocument();
  });

  it("does not render confetti when reduced motion is preferred", () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<CelebrationOverlay {...defaultProps()} />);
    const overlay = screen.getByTestId("celebration-overlay");
    const particles = overlay.querySelectorAll("[data-confetti]");
    expect(particles).toHaveLength(0);
  });

  // --- AC#11: ARIA attributes ---
  it("has role=status and aria-live=assertive on savings announcement", () => {
    render(<CelebrationOverlay {...defaultProps()} />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "assertive");
  });

  // --- AC#1: Session summary ---
  it("renders session summary with pause duration, savings, and mindful days", () => {
    render(<CelebrationOverlay {...defaultProps()} />);
    const summary = screen.getByTestId("session-summary");
    expect(summary.textContent).toContain("15s");
    expect(summary.textContent).toContain("$12.50");
    expect(summary.textContent).toContain("3 days");
  });

  // --- AC#12: amountCents divided by 100 ---
  it("divides amountCents by 100 for dollar display", () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<CelebrationOverlay {...defaultProps()} />);
    const counter = screen.getByTestId("savings-counter");
    expect(counter.textContent).toContain("$12.50");
  });

  // --- AC#2: Scrim backdrop ---
  it("renders with --pause-scrim backdrop", () => {
    render(<CelebrationOverlay {...defaultProps()} />);
    const overlay = screen.getByTestId("celebration-overlay");
    expect(overlay.style.backgroundColor).toBe("var(--pause-scrim)");
  });

  // --- AC#2: z-index overlay ---
  it("uses z-index var(--z-overlay)", () => {
    render(<CelebrationOverlay {...defaultProps()} />);
    const overlay = screen.getByTestId("celebration-overlay");
    expect(overlay.style.zIndex).toBe("var(--z-overlay)");
  });

  // --- singular day ---
  it("uses singular 'day' when mindfulDays is 1", () => {
    const props = { ...defaultProps(), mindfulDays: 1 };
    render(<CelebrationOverlay {...props} />);
    expect(screen.getByTestId("session-summary").textContent).toContain(
      "1 day"
    );
  });
});
