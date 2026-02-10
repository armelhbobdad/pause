import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatsPanel } from "./stats-panel";

const defaultProps = {
  streak: 3,
  pauses: 7,
  goodFrictionScore: 85,
  sparklineData: [],
  hidden: false,
};

describe("StatsPanel", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the stats panel", () => {
    render(<StatsPanel {...defaultProps} />);
    expect(screen.getByTestId("stats-panel")).toBeDefined();
  });

  it("renders toggle button with aria-expanded=false by default", () => {
    render(<StatsPanel {...defaultProps} />);
    const toggle = screen.getByTestId("stats-panel-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("expands panel when toggle is clicked", () => {
    render(<StatsPanel {...defaultProps} />);
    const toggle = screen.getByTestId("stats-panel-toggle");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("stats-panel-content")).toBeDefined();
  });

  it("renders 3 metric items when expanded", () => {
    render(<StatsPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("stats-panel-toggle"));
    expect(screen.getByTestId("stat-streak")).toBeDefined();
    expect(screen.getByTestId("stat-pauses")).toBeDefined();
    expect(screen.getByTestId("stat-friction-score")).toBeDefined();
  });

  it("collapses panel when toggle is clicked again", () => {
    render(<StatsPanel {...defaultProps} />);
    const toggle = screen.getByTestId("stats-panel-toggle");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("persists expanded state to localStorage", () => {
    render(<StatsPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("stats-panel-toggle"));
    expect(localStorage.getItem("pause-stats-pinned-v1")).toBe("true");
  });

  it("falls back to collapsed when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    render(<StatsPanel {...defaultProps} />);
    const toggle = screen.getByTestId("stats-panel-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("returns null when hidden is true", () => {
    const { container } = render(<StatsPanel {...defaultProps} hidden />);
    expect(container.querySelector("[data-testid='stats-panel']")).toBeNull();
  });

  it("has aria-controls on toggle linking to content", () => {
    render(<StatsPanel {...defaultProps} />);
    const toggle = screen.getByTestId("stats-panel-toggle");
    expect(toggle.getAttribute("aria-controls")).toBe("stats-panel-content");
  });

  it("renders sparkline container when expanded", () => {
    render(<StatsPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("stats-panel-toggle"));
    expect(screen.getByTestId("sparkline-container")).toBeDefined();
  });

  it("uses three-column grid layout (grid-cols-3 class)", () => {
    render(<StatsPanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("stats-panel-toggle"));
    const grid = screen.getByTestId("stats-grid");
    expect(grid.className).toContain("grid-cols-3");
  });

  it("renders children inside expanded panel", () => {
    render(
      <StatsPanel {...defaultProps}>
        <div data-testid="child-content">Recent activity</div>
      </StatsPanel>
    );
    fireEvent.click(screen.getByTestId("stats-panel-toggle"));
    expect(screen.getByTestId("child-content")).toBeDefined();
  });
});
