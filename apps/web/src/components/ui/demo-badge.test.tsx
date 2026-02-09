import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DemoBadge } from "./demo-badge";

describe("DemoBadge", () => {
  const originalEnv = process.env.NEXT_PUBLIC_DEMO_MODE;

  afterEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = originalEnv;
    cleanup();
  });

  describe("when NEXT_PUBLIC_DEMO_MODE is 'true'", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    });

    it("renders the DEMO badge", () => {
      render(<DemoBadge />);
      expect(screen.getByText("DEMO")).toBeDefined();
    });

    it("renders as output element with accessible label", () => {
      render(<DemoBadge />);
      const badge = screen.getByRole("status");
      expect(badge).toBeDefined();
      expect(badge.tagName).toBe("OUTPUT");
      expect(badge.getAttribute("aria-label")).toBe("Demo mode active");
    });

    it("has correct positioning styles", () => {
      render(<DemoBadge />);
      const badge = screen.getByRole("status");
      expect(badge.style.position).toBe("fixed");
      expect(badge.style.bottom).toBe("16px");
      expect(badge.style.left).toBe("60px");
      expect(badge.style.zIndex).toBe("50");
    });

    it("uses monospace font and does not block interaction", () => {
      render(<DemoBadge />);
      const badge = screen.getByRole("status");
      expect(badge.style.fontFamily).toBe("var(--font-data)");
      expect(badge.style.pointerEvents).toBe("none");
    });
  });

  describe("when NEXT_PUBLIC_DEMO_MODE is not 'true'", () => {
    it("returns null when NEXT_PUBLIC_DEMO_MODE is 'false'", () => {
      process.env.NEXT_PUBLIC_DEMO_MODE = "false";
      const { container } = render(<DemoBadge />);
      expect(container.innerHTML).toBe("");
    });

    it("returns null when NEXT_PUBLIC_DEMO_MODE is undefined", () => {
      process.env.NEXT_PUBLIC_DEMO_MODE = undefined;
      const { container } = render(<DemoBadge />);
      expect(container.innerHTML).toBe("");
    });
  });
});
