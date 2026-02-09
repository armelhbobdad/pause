import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResolutionButtons } from "./resolution-buttons";

const OVERRIDE_RE = /Override/;

function defaultProps() {
  return {
    reflectionComplete: true,
    onWait: vi.fn(),
    onReveal: vi.fn(),
    onOverride: vi.fn(),
  };
}

describe("ResolutionButtons", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- AC#5: Three buttons render with correct labels ---
  it("renders three buttons after 500ms delay", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText("Wait 24 Hours")).toBeInTheDocument();
    expect(screen.getByText("Reveal My Card")).toBeInTheDocument();
    expect(screen.getByText(OVERRIDE_RE)).toBeInTheDocument();
  });

  // --- AC#5: 500ms delay before buttons appear ---
  it("does not show buttons before 500ms", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.queryByTestId("resolution-buttons")).not.toBeInTheDocument();
  });

  it("shows buttons after 500ms", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId("resolution-buttons")).toBeInTheDocument();
  });

  // --- Buttons don't appear when reflectionComplete is false ---
  it("does not show buttons when reflectionComplete is false", () => {
    render(
      <ResolutionButtons {...defaultProps()} reflectionComplete={false} />
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId("resolution-buttons")).not.toBeInTheDocument();
  });

  // --- AC#8: Auto-focus on Wait button after animation ---
  it("auto-focuses Wait button when buttons appear", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId("resolution-wait")).toHaveFocus();
  });

  // --- AC#6: Wait selection dispatches correct action ---
  it("calls onWait when Wait 24 Hours is clicked", () => {
    const props = defaultProps();
    render(<ResolutionButtons {...props} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.click(screen.getByTestId("resolution-wait"));
    expect(props.onWait).toHaveBeenCalledOnce();
  });

  // --- AC#6: Reveal selection dispatches correct action ---
  it("calls onReveal when Reveal My Card is clicked", () => {
    const props = defaultProps();
    render(<ResolutionButtons {...props} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.click(screen.getByTestId("resolution-reveal"));
    expect(props.onReveal).toHaveBeenCalledOnce();
  });

  // --- AC#6: Override selection dispatches correct action ---
  it("calls onOverride when Override is clicked", () => {
    const props = defaultProps();
    render(<ResolutionButtons {...props} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.click(screen.getByTestId("resolution-override"));
    expect(props.onOverride).toHaveBeenCalledOnce();
  });

  // --- AC#6: Selected button pulses, others fade ---
  it("fades non-selected buttons when one is selected", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.click(screen.getByTestId("resolution-wait"));

    const reveal = screen.getByTestId("resolution-reveal");
    const override = screen.getByTestId("resolution-override");
    expect(reveal.style.opacity).toBe("0.3");
    expect(override.style.opacity).toBe("0.3");
  });

  it("selected button retains full opacity", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.click(screen.getByTestId("resolution-wait"));

    const wait = screen.getByTestId("resolution-wait");
    expect(wait.style.opacity).toBe("1");
  });

  // --- AC#8: ARIA attributes ---
  it('has role="group" and aria-label="Choose how to resolve"', () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const group = screen.getByRole("group");
    expect(group).toHaveAttribute("aria-label", "Choose how to resolve");
  });

  // --- AC#7: Override is physically separated (margin-top) ---
  it("Override button has margin-top for physical separation", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const override = screen.getByTestId("resolution-override");
    expect(override.style.marginTop).toBe("var(--space-4)");
  });

  // --- AC#7: Touch targets meet 44x44px minimum ---
  it("Wait button meets 48px minimum height", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const wait = screen.getByTestId("resolution-wait");
    expect(wait.style.minHeight).toBe("48px");
  });

  it("Override button meets 44px minimum touch target via padding", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const override = screen.getByTestId("resolution-override");
    expect(override.style.minHeight).toBe("44px");
    expect(override.style.padding).toBe("12px 16px");
  });

  // --- AC#10: Tab order ---
  it("tab order follows visual order: Wait -> Reveal -> Override", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Wait 24 Hours");
    expect(buttons[1]).toHaveTextContent("Reveal My Card");
    expect(buttons[2]).toHaveTextContent(OVERRIDE_RE);
  });

  // --- Only one selection allowed ---
  it("prevents double selection", () => {
    const props = defaultProps();
    render(<ResolutionButtons {...props} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.click(screen.getByTestId("resolution-wait"));
    fireEvent.click(screen.getByTestId("resolution-reveal"));

    expect(props.onWait).toHaveBeenCalledOnce();
    expect(props.onReveal).not.toHaveBeenCalled();
  });

  // --- Reveal button uses --pause-success background ---
  it("Reveal button uses --pause-success background color", () => {
    render(<ResolutionButtons {...defaultProps()} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    const reveal = screen.getByTestId("resolution-reveal");
    expect(reveal.style.backgroundColor).toBe("var(--pause-success)");
  });
});
