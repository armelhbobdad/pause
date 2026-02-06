import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BestOffer } from "@/lib/guardian/types";
import { SavingsTicket } from "./savings-ticket";

const APPLY_UNLOCK_PATTERN = /Apply & Unlock/;
const APPLIED_PATTERN = /Applied ✓/;
const APPLYING_PATTERN = /Applying…/;
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

// ============================================================================
// Action Button Tests (Story 4.5)
// ============================================================================

describe("SavingsTicket — action buttons", () => {
  it("renders Apply & Unlock button when onApply is provided", () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(<SavingsTicket bestOffer={makeBestOffer()} onApply={onApply} />);

    expect(screen.getByText(APPLY_UNLOCK_PATTERN)).toBeInTheDocument();
  });

  it("button is disabled and shows spinner when isApplying=true", () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(
      <SavingsTicket
        bestOffer={makeBestOffer()}
        isApplying={true}
        onApply={onApply}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(screen.getByText(APPLYING_PATTERN)).toBeInTheDocument();
  });

  it("button is disabled when disabled=true", () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(
      <SavingsTicket
        bestOffer={makeBestOffer()}
        disabled={true}
        onApply={onApply}
      />
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows Applied ✓ indicator when isApplied=true", () => {
    render(
      <SavingsTicket
        bestOffer={makeBestOffer()}
        isApplied={true}
        onApply={vi.fn()}
      />
    );

    expect(screen.getByText(APPLIED_PATTERN)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onApply with bestOffer when button is clicked", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockResolvedValue(undefined);
    const offer = makeBestOffer();
    render(<SavingsTicket bestOffer={offer} onApply={onApply} />);

    await user.click(screen.getByRole("button"));

    expect(onApply).toHaveBeenCalledWith(offer);
  });

  it("button has correct aria-label", () => {
    const onApply = vi.fn().mockResolvedValue(undefined);
    render(<SavingsTicket bestOffer={makeBestOffer()} onApply={onApply} />);

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Apply coupon and unlock card"
    );
  });

  it("does not render action button when onApply is not provided", () => {
    render(<SavingsTicket bestOffer={makeBestOffer()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(APPLY_UNLOCK_PATTERN)).not.toBeInTheDocument();
  });
});
