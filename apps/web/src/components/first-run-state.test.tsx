import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
    span: "span",
    button: "button",
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { FirstRunState } from "./first-run-state";

describe("FirstRunState (Story 10.4)", () => {
  it("renders welcoming message", () => {
    render(<FirstRunState />);
    expect(
      screen.getByText(
        "Your card is protected. Tap to start your first Guardian flow."
      )
    ).toBeInTheDocument();
  });

  it("renders demo button", () => {
    render(<FirstRunState />);
    expect(screen.getByText("See Pause in Action")).toBeInTheDocument();
  });

  it("card vault is visible with aria-label", () => {
    render(<FirstRunState />);
    const card = screen.getByRole("img", {
      name: "Your protected card vault",
    });
    expect(card).toBeInTheDocument();
  });

  it("card vault has breathing animation", () => {
    render(<FirstRunState />);
    const card = screen.getByRole("img", {
      name: "Your protected card vault",
    });
    expect(card.style.animation).toContain("card-breathe");
  });
});
