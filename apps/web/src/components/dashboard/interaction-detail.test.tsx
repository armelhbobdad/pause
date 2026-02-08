import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InteractionDetail } from "./interaction-detail";

describe("InteractionDetail", () => {
  it("renders reasoning summary", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="accepted"
        reasoningSummary="Low risk grocery purchase"
        savingsAmountCents={null}
        tier="analyst"
      />
    );

    expect(screen.getByTestId("detail-reasoning")).toHaveTextContent(
      "Low risk grocery purchase"
    );
  });

  it("renders strategy based on tier", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="accepted"
        reasoningSummary="Analysis complete"
        savingsAmountCents={null}
        tier="analyst"
      />
    );

    expect(screen.getByTestId("detail-strategy")).toHaveTextContent(
      "Risk Analysis"
    );
  });

  it("renders negotiator strategy", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="accepted"
        reasoningSummary={null}
        savingsAmountCents={null}
        tier="negotiator"
      />
    );

    expect(screen.getByTestId("detail-strategy")).toHaveTextContent(
      "Coupon Search"
    );
  });

  it("renders therapist strategy", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="wait"
        reasoningSummary={null}
        savingsAmountCents={null}
        tier="therapist"
      />
    );

    expect(screen.getByTestId("detail-strategy")).toHaveTextContent(
      "Behavioral Strategy"
    );
  });

  it("renders savings amount and coupon code", () => {
    render(
      <InteractionDetail
        couponCode="SAVE20"
        outcome="accepted"
        reasoningSummary={null}
        savingsAmountCents={2000}
        tier="negotiator"
      />
    );

    expect(screen.getByTestId("detail-savings")).toHaveTextContent("$20.00");
    expect(screen.getByTestId("detail-coupon")).toHaveTextContent("SAVE20");
  });

  it("does not render savings section when no savings", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="accepted"
        reasoningSummary={null}
        savingsAmountCents={null}
        tier="analyst"
      />
    );

    expect(screen.queryByTestId("detail-savings")).not.toBeInTheDocument();
  });

  it("renders outcome as decision", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="overridden"
        reasoningSummary={null}
        savingsAmountCents={null}
        tier="analyst"
      />
    );

    expect(screen.getByTestId("detail-outcome")).toHaveTextContent(
      "overridden"
    );
  });

  it("does not render outcome section when null", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome={null}
        reasoningSummary={null}
        savingsAmountCents={null}
        tier="analyst"
      />
    );

    expect(screen.queryByTestId("detail-outcome")).not.toBeInTheDocument();
  });

  it("renders satisfaction feedback when provided", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="accepted"
        reasoningSummary={null}
        satisfactionStatus="worth_it"
        savingsAmountCents={null}
        tier="analyst"
      />
    );

    expect(screen.getByTestId("detail-satisfaction")).toHaveTextContent(
      "worth_it"
    );
  });

  it("does not render satisfaction section when not provided", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="accepted"
        reasoningSummary={null}
        savingsAmountCents={null}
        tier="analyst"
      />
    );

    expect(screen.queryByTestId("detail-satisfaction")).not.toBeInTheDocument();
  });

  it("does not render reasoning when null", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="accepted"
        reasoningSummary={null}
        savingsAmountCents={null}
        tier="analyst"
      />
    );

    expect(screen.queryByTestId("detail-reasoning")).not.toBeInTheDocument();
  });

  it("renders savings without coupon code", () => {
    render(
      <InteractionDetail
        couponCode={null}
        outcome="accepted"
        reasoningSummary={null}
        savingsAmountCents={500}
        tier="negotiator"
      />
    );

    expect(screen.getByTestId("detail-savings")).toHaveTextContent("$5.00");
    expect(screen.queryByTestId("detail-coupon")).not.toBeInTheDocument();
  });
});
