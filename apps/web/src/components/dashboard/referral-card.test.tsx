import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BANNED_TERMS_MAP } from "@/lib/server/guardian/filters";

import { ReferralCard } from "./referral-card";

vi.mock("server-only", () => ({}));

const BANNED_TERMS = Object.keys(BANNED_TERMS_MAP);
const WARNING_CLASS_PATTERN = /red|warning|danger|destructive/i;

describe("ReferralCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders with correct header text", () => {
    render(<ReferralCard consecutiveOverrides={3} />);

    expect(screen.getByText("Resources that might help")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Some people find these helpful when managing spending habits"
      )
    ).toBeInTheDocument();
  });

  it("shows resource links", () => {
    render(<ReferralCard consecutiveOverrides={3} />);

    const nfccLink = screen.getByText(
      "National Foundation for Credit Counseling"
    );
    expect(nfccLink).toBeInTheDocument();
    expect(nfccLink.closest("a")).toHaveAttribute(
      "href",
      "https://www.nfcc.org"
    );
    expect(nfccLink.closest("a")).toHaveAttribute("target", "_blank");
    expect(nfccLink.closest("a")).toHaveAttribute("rel", "noopener noreferrer");

    const wellnessLink = screen.getByText("Financial wellness resources");
    expect(wellnessLink).toBeInTheDocument();
    expect(wellnessLink.closest("a")).toHaveAttribute("target", "_blank");
  });

  it("dismiss button hides card", () => {
    render(<ReferralCard consecutiveOverrides={3} />);

    expect(screen.getByTestId("referral-card")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("referral-dismiss"));

    expect(screen.queryByTestId("referral-card")).not.toBeInTheDocument();
    expect(localStorage.getItem("pause:referral-dismissed")).not.toBeNull();
  });

  it("is not rendered when consecutiveOverrides < 1", () => {
    render(<ReferralCard consecutiveOverrides={0} />);

    expect(screen.queryByTestId("referral-card")).not.toBeInTheDocument();
  });

  it("is not rendered when previously dismissed", () => {
    localStorage.setItem("pause:referral-dismissed", Date.now().toString());

    render(<ReferralCard consecutiveOverrides={5} />);

    expect(screen.queryByTestId("referral-card")).not.toBeInTheDocument();
  });

  it("contains no banned terminology", () => {
    render(<ReferralCard consecutiveOverrides={3} />);

    const cardEl = screen.getByTestId("referral-card");
    const cardText = (cardEl.textContent ?? "").toLowerCase();

    for (const term of BANNED_TERMS) {
      const termRegex = new RegExp(`\\b${term}\\b`, "i");
      expect(termRegex.test(cardText)).toBe(false);
    }
  });

  it("uses neutral colors (not red/warning)", () => {
    render(<ReferralCard consecutiveOverrides={3} />);

    const cardEl = screen.getByTestId("referral-card");

    // Verify no warning-related classes on the card
    expect(cardEl.className).not.toMatch(WARNING_CLASS_PATTERN);

    // Card does not use role="alert" (not alarming)
    expect(cardEl.getAttribute("role")).not.toBe("alert");

    // Verify rounded corners (consistent with dashboard cards)
    const style = cardEl.getAttribute("style") ?? "";
    expect(style).toContain("border-radius: 12px");
  });
});
