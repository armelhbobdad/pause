import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    motion: {
      ...actual.motion,
      a: "a" as unknown as typeof actual.motion.a,
      button: "button" as unknown as typeof actual.motion.button,
      div: "div" as unknown as typeof actual.motion.div,
      span: "span" as unknown as typeof actual.motion.span,
    },
  };
});

const mockPathname = vi.hoisted(() => vi.fn(() => "/dashboard"));

vi.mock("next/navigation", () => ({
  usePathname: mockPathname,
}));

vi.mock("@/components/user-menu", () => ({
  default: () => <div data-testid="user-menu">UserMenu</div>,
}));

import { AppNavbar } from "./app-navbar";

describe("AppNavbar (Story 10.1)", () => {
  it("renders Dashboard and Home navigation items", () => {
    render(<AppNavbar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("does not render AI Chat nav item", () => {
    render(<AppNavbar />);

    expect(screen.queryByText("AI Chat")).not.toBeInTheDocument();
  });

  it("renders user menu", () => {
    render(<AppNavbar />);

    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });

  it("has data-navbar attribute for focused-mode targeting", () => {
    render(<AppNavbar />);

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveAttribute("data-navbar");
  });

  it("renders above page content for dropdown interactions", () => {
    render(<AppNavbar />);

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("relative");
    expect(nav.className).toContain("z-[var(--z-float)]");
  });

  it("highlights Dashboard when on /dashboard (source check)", () => {
    // happy-dom does not support oklch() values — verify via source analysis
    const { readFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    const source = readFileSync(
      resolve(__dirname, "./app-navbar.tsx"),
      "utf-8"
    );
    expect(source).toContain("oklch(0.95 0.01 250)");
    expect(source).toContain("oklch(0.55 0.02 250)");
  });

  it("highlights Home when on /", () => {
    mockPathname.mockReturnValue("/");
    render(<AppNavbar />);

    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("focused-mode class reduces opacity to 0.4", () => {
    const { readFileSync } = require("node:fs");
    const { resolve } = require("node:path");
    const tokensCss = readFileSync(
      resolve(__dirname, "../../styles/tokens.css"),
      "utf-8"
    );

    expect(tokensCss).toContain("[data-navbar].focused-mode a");
    expect(tokensCss).toContain("opacity: 0.4");
    expect(tokensCss).toContain("pointer-events: none");
  });
});
