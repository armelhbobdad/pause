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

import { LandingHero } from "./landing-hero";

describe("LandingHero (Story 10.4)", () => {
  it("renders thesis statement in an h1 element", () => {
    render(<LandingHero />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent(
      "Good Friction — AI that helps you pause before impulse purchases"
    );
  });

  it("applies clamp font size to h1 (source verification)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(__dirname, "./landing-hero.tsx"),
      "utf-8"
    );
    expect(source).toContain("clamp(1.75rem, 5vw, 2.5rem)");
  });

  it("renders primary CTA with time estimate (~45s)", () => {
    render(<LandingHero />);
    const cta = screen.getByText("See Pause in Action (~45s)");
    expect(cta).toBeInTheDocument();
  });

  it("renders primary CTA link pointing to /login", () => {
    render(<LandingHero />);
    const link = screen.getByText("See Pause in Action (~45s)").closest("a");
    expect(link).toHaveAttribute("href", "/login");
  });

  it("renders secondary CTA text link for AI traces", () => {
    render(<LandingHero />);
    const link = screen.getByText("or explore the AI traces");
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
  });

  it("renders Financial Health prize badge", () => {
    render(<LandingHero />);
    expect(screen.getByText("Financial Health")).toBeInTheDocument();
  });

  it("renders Best Use of Opik prize badge", () => {
    render(<LandingHero />);
    expect(screen.getByText("Best Use of Opik")).toBeInTheDocument();
  });

  it("card preview has aria-label describing purpose", () => {
    render(<LandingHero />);
    const cardPreview = screen.getByRole("img", {
      name: "Card vault preview showing a protected payment card",
    });
    expect(cardPreview).toBeInTheDocument();
  });

  it("card preview uses CSS-only breathing animation", () => {
    render(<LandingHero />);
    const cardPreview = screen.getByRole("img", {
      name: "Card vault preview showing a protected payment card",
    });
    expect(cardPreview.style.animation).toContain("card-breathe");
    expect(cardPreview.style.animation).toContain(
      "var(--pause-timing-breathe)"
    );
  });

  it("renders within a semantic section element", () => {
    render(<LandingHero />);
    const section = document.querySelector("section");
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute("aria-labelledby", "hero-heading");
  });

  it("hero container has max-width 1200px", () => {
    render(<LandingHero />);
    const section = document.querySelector("section");
    expect(section?.className).toContain("max-w-[1200px]");
  });
});
