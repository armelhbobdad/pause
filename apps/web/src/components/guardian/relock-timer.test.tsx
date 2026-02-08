import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelockTimer } from "./relock-timer";

describe("RelockTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders progress bar when isActive is true", () => {
    render(
      <RelockTimer durationMs={300_000} isActive={true} onExpire={vi.fn()} />
    );
    expect(screen.getByTestId("relock-timer")).toBeInTheDocument();
    expect(screen.getByTestId("relock-timer-bar")).toBeInTheDocument();
  });

  it("does not render when isActive is false", () => {
    render(
      <RelockTimer durationMs={300_000} isActive={false} onExpire={vi.fn()} />
    );
    expect(screen.queryByTestId("relock-timer")).not.toBeInTheDocument();
  });

  it("calls onExpire after durationMs elapses", () => {
    const onExpire = vi.fn();
    render(
      <RelockTimer durationMs={5000} isActive={true} onExpire={onExpire} />
    );

    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onExpire).toHaveBeenCalledOnce();
  });

  it("shows green color at start", () => {
    render(
      <RelockTimer durationMs={300_000} isActive={true} onExpire={vi.fn()} />
    );

    const bar = screen.getByTestId("relock-timer-bar");
    expect(bar.style.background).toBe("var(--relock-green)");
  });

  it("shows yellow color at 50% elapsed", () => {
    render(
      <RelockTimer durationMs={10_000} isActive={true} onExpire={vi.fn()} />
    );

    // Advance to 50% — fraction = 0.5, which is between 0.3 and 0.6 → yellow
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const bar = screen.getByTestId("relock-timer-bar");
    expect(bar.style.background).toBe("var(--relock-yellow)");
  });

  it("shows red color near end (90% elapsed)", () => {
    render(
      <RelockTimer durationMs={10_000} isActive={true} onExpire={vi.fn()} />
    );

    // Advance to 90% — fraction = 0.1, which is < 0.3 → red
    act(() => {
      vi.advanceTimersByTime(9000);
    });

    const bar = screen.getByTestId("relock-timer-bar");
    expect(bar.style.background).toBe("var(--relock-red)");
  });

  it("stops timer when isActive changes to false", () => {
    const onExpire = vi.fn();
    const { rerender } = render(
      <RelockTimer durationMs={5000} isActive={true} onExpire={onExpire} />
    );

    // Advance partway
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Deactivate
    rerender(
      <RelockTimer durationMs={5000} isActive={false} onExpire={onExpire} />
    );

    // Advance past original expiry
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onExpire).not.toHaveBeenCalled();
    expect(screen.queryByTestId("relock-timer")).not.toBeInTheDocument();
  });

  it("bar starts at scaleX(1) before animation starts", () => {
    render(
      <RelockTimer durationMs={300_000} isActive={true} onExpire={vi.fn()} />
    );

    // Before rAF fires, transform should be scaleX(1)
    const bar = screen.getByTestId("relock-timer-bar");
    expect(bar.style.transform).toBe("scaleX(1)");
  });

  it("is hidden from screen readers via aria-hidden", () => {
    render(
      <RelockTimer durationMs={300_000} isActive={true} onExpire={vi.fn()} />
    );

    const timer = screen.getByTestId("relock-timer");
    expect(timer.getAttribute("aria-hidden")).toBe("true");
  });
});
