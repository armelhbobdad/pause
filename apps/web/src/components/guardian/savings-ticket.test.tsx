import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BestOffer } from "@/lib/guardian/types";
import { SavingsTicket } from "./savings-ticket";

const CODE_SAVE35_PATTERN = /Code: SAVE35/;
const VIA_TECHDEALS_PATTERN = /via TechDeals/;
const PRICE_MATCH_FOUND_PATTERN = /Price match found/;
const CODE_PATTERN = /Code:/;
const EXPIRES_PATTERN = /Expires/;
const EXPIRES_FEB_15_PATTERN = /Expires Feb 15/;

function makeBestOffer(overrides: Partial<BestOffer> = {}): BestOffer {
  return {
    code: "SAVE35",
    discount: "$35 off",
    discountCents: 3500,
    type: "fixed",
    source: "TechDeals",
    expiresAt: "2026-02-15T00:00:00.000Z",
    selectionReasoning: "Selected SAVE35 — only offer available.",
    ...overrides,
  };
}

describe("SavingsTicket", () => {
  it("renders savings amount for fixed discount", () => {
    render(<SavingsTicket bestOffer={makeBestOffer()} />);

    expect(screen.getByText("-$35.00")).toBeInTheDocument();
  });

  it("renders savings amount for percentage discount", () => {
    render(
      <SavingsTicket
        bestOffer={makeBestOffer({
          type: "percentage",
          discount: "15% off",
          discountCents: 1500,
        })}
      />
    );

    expect(screen.getByText("15% OFF")).toBeInTheDocument();
  });

  it("renders coupon code in monospace font", () => {
    render(<SavingsTicket bestOffer={makeBestOffer()} />);

    const codeEl = screen.getByText(CODE_SAVE35_PATTERN);
    expect(codeEl).toBeInTheDocument();
    expect(codeEl.style.fontFamily).toContain("var(--font-data)");
  });

  it("renders source attribution", () => {
    render(<SavingsTicket bestOffer={makeBestOffer()} />);

    expect(screen.getByText(VIA_TECHDEALS_PATTERN)).toBeInTheDocument();
  });

  it("returns null when bestOffer is null", () => {
    const { container } = render(<SavingsTicket bestOffer={null} />);

    expect(container.innerHTML).toBe("");
  });

  it("hides coupon code for price_match type", () => {
    render(
      <SavingsTicket
        bestOffer={makeBestOffer({
          type: "price_match",
          discount: "$15 off",
          discountCents: 1500,
          code: "PRICEMATCH",
        })}
      />
    );

    expect(screen.getByText(PRICE_MATCH_FOUND_PATTERN)).toBeInTheDocument();
    expect(screen.queryByText(CODE_PATTERN)).not.toBeInTheDocument();
  });

  it("has correct aria attributes", () => {
    render(<SavingsTicket bestOffer={makeBestOffer()} />);

    const ticket = screen.getByRole("status");
    expect(ticket).toHaveAttribute("aria-live", "assertive");
    expect(ticket).toHaveAttribute(
      "aria-label",
      "Savings found: -$35.00 with code SAVE35"
    );
  });

  it("hides expiration when expiresAt is null", () => {
    render(<SavingsTicket bestOffer={makeBestOffer({ expiresAt: null })} />);

    expect(screen.queryByText(EXPIRES_PATTERN)).not.toBeInTheDocument();
  });

  it("renders discount string directly when discountCents is 0", () => {
    render(
      <SavingsTicket
        bestOffer={makeBestOffer({
          type: "percentage",
          discount: "20% off",
          discountCents: 0,
        })}
      />
    );

    expect(screen.getByText("20% OFF")).toBeInTheDocument();
  });

  it("renders expiration date when expiresAt is provided", () => {
    render(
      <SavingsTicket
        bestOffer={makeBestOffer({
          expiresAt: "2026-02-15T00:00:00.000Z",
        })}
      />
    );

    expect(screen.getByText(EXPIRES_FEB_15_PATTERN)).toBeInTheDocument();
  });

  it("applies custom className alongside default classes", () => {
    render(
      <SavingsTicket bestOffer={makeBestOffer()} className="custom-class" />
    );

    const ticket = screen.getByRole("status");
    expect(ticket.className).toContain("savings-ticket");
    expect(ticket.className).toContain("custom-class");
  });
});
