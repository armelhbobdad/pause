import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const SIGN_OUT_LABEL = /sign out/i;

vi.mock("framer-motion", () => ({
  motion: {
    div: "div",
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

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          name: "Jane Doe",
          email: "jane@example.com",
        },
      },
      isPending: false,
    }),
  },
}));

import UserMenu from "./user-menu";

describe("UserMenu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers click (not mousedown) outside handler when open", async () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const user = userEvent.setup();

    render(<UserMenu />);

    await user.click(screen.getByRole("button", { name: "JD" }));

    expect(await screen.findByRole("menu")).toBeInTheDocument();

    const eventTypes = addSpy.mock.calls.map((call) => call[0]);
    expect(eventTypes).toContain("click");
    expect(eventTypes).not.toContain("mousedown");
  });

  it("navigates to /api/sign-out on click", async () => {
    const assignSpy = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => undefined);
    const user = userEvent.setup();

    render(<UserMenu />);

    await user.click(screen.getByRole("button", { name: "JD" }));
    await user.click(screen.getByRole("menuitem", { name: SIGN_OUT_LABEL }));

    expect(assignSpy).toHaveBeenCalledWith("/api/sign-out");
  });
});
