import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardFace } from "./card-face";

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

describe("CardFace", () => {
  it("renders the masked card number", () => {
    render(<CardFace />);
    const cardNumber = screen.getByTestId("card-number");
    expect(cardNumber).toHaveTextContent("**** **** **** 4242");
  });

  it("renders the cardholder name", () => {
    render(<CardFace />);
    const name = screen.getByTestId("cardholder-name");
    expect(name).toHaveTextContent("A. HOLDER");
  });

  it("renders the expiry date", () => {
    render(<CardFace />);
    const expiry = screen.getByTestId("card-expiry");
    expect(expiry).toHaveTextContent("12/28");
  });

  it("uses design tokens for border (--pause-border-elevated)", () => {
    render(<CardFace />);
    const cardFace = screen.getByTestId("card-face");
    const html = cardFace.outerHTML;
    expect(html).toContain("--pause-border-elevated");
  });

  it("uses design tokens for foreground color (--foreground)", () => {
    render(<CardFace />);
    const cardNumber = screen.getByTestId("card-number");
    const html = cardNumber.outerHTML;
    expect(html).toContain("var(--foreground)");
  });

  it("uses --font-conversation token for label text", () => {
    render(<CardFace />);
    const name = screen.getByTestId("cardholder-name");
    const html = name.outerHTML;
    expect(html).toContain("var(--font-conversation)");
  });

  it("renders with rounded-2xl border radius", () => {
    render(<CardFace />);
    const cardFace = screen.getByTestId("card-face");
    expect(cardFace.className).toContain("rounded-2xl");
  });

  it("uses monospace font family for card number", () => {
    render(<CardFace />);
    const cardNumber = screen.getByTestId("card-number");
    const html = cardNumber.outerHTML;
    expect(html).toContain("var(--font-data)");
  });
});
