import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
    span: "span",
    button: "button",
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

const PROTECTED_DAYS_RE = /protected for 10 days/;
const SAVINGS_42_50_RE = /\$42\.50/;
const SAVINGS_1_50_RE = /\$1\.50/;

import { DormantState } from "./dormant-state";

describe("DormantState (Story 10.4)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-09T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders message with correct days and savings", () => {
    render(
      <DormantState daysSinceLastInteraction={10} totalSavingsCents={4250} />
    );
    expect(screen.getByText(PROTECTED_DAYS_RE)).toBeInTheDocument();
    expect(screen.getByText(SAVINGS_42_50_RE)).toBeInTheDocument();
  });

  it("divides amountCents by 100 for dollar display", () => {
    render(
      <DormantState daysSinceLastInteraction={7} totalSavingsCents={150} />
    );
    expect(screen.getByText(SAVINGS_1_50_RE)).toBeInTheDocument();
  });

  it("does not render when daysSinceLastInteraction < 7", () => {
    render(
      <DormantState daysSinceLastInteraction={6} totalSavingsCents={1000} />
    );
    expect(screen.queryByTestId("dormant-state")).not.toBeInTheDocument();
  });

  it("renders when daysSinceLastInteraction is exactly 7", () => {
    render(
      <DormantState daysSinceLastInteraction={7} totalSavingsCents={1000} />
    );
    expect(screen.getByTestId("dormant-state")).toBeInTheDocument();
  });

  it("uses output element for status semantics", () => {
    render(
      <DormantState daysSinceLastInteraction={14} totalSavingsCents={2000} />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("dismisses when close button is clicked", () => {
    render(
      <DormantState daysSinceLastInteraction={10} totalSavingsCents={5000} />
    );
    expect(screen.getByTestId("dormant-state")).toBeInTheDocument();

    const dismissBtn = screen.getByRole("button", {
      name: "Dismiss dormant message",
    });
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId("dormant-state")).not.toBeInTheDocument();
  });

  it("persists dismissal in localStorage", () => {
    render(
      <DormantState daysSinceLastInteraction={10} totalSavingsCents={5000} />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss dormant message" })
    );

    expect(localStorage.getItem("pause-dormant-dismissed-v1")).toBeTruthy();
  });
});
