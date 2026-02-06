import { describe, expect, it } from "vitest";
import type { CouponResult } from "./coupon-provider";
import { selectBestOffer } from "./offer-selection";

describe("selectBestOffer", () => {
  const baseCoupon = (
    overrides: Partial<CouponResult> & { code: string }
  ): CouponResult => ({
    discount: "10% off",
    type: "percentage",
    source: "DealFinder",
    expiresAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  });

  it("with multiple results returns highest discount", () => {
    const coupons: CouponResult[] = [
      baseCoupon({ code: "LOW5", discount: "$5 off", type: "fixed" }),
      baseCoupon({ code: "HIGH20", discount: "$20 off", type: "fixed" }),
      baseCoupon({ code: "MID10", discount: "$10 off", type: "fixed" }),
    ];

    const result = selectBestOffer(coupons);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("HIGH20");
    expect(result?.discountCents).toBe(2000);
  });

  it("with single result returns it directly", () => {
    const coupons: CouponResult[] = [
      baseCoupon({ code: "ONLY1", discount: "$15 off", type: "fixed" }),
    ];

    const result = selectBestOffer(coupons);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("ONLY1");
    expect(result?.discountCents).toBe(1500);
  });

  it("with empty results returns null", () => {
    const result = selectBestOffer([]);
    expect(result).toBeNull();
  });

  it("prefers fixed over percentage when no price given", () => {
    const coupons: CouponResult[] = [
      baseCoupon({
        code: "PCT20",
        discount: "20% off",
        type: "percentage",
      }),
      baseCoupon({ code: "FIX10", discount: "$10 off", type: "fixed" }),
    ];

    const result = selectBestOffer(coupons);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("FIX10");
  });

  it("uses price to calculate percentage value when available", () => {
    const coupons: CouponResult[] = [
      baseCoupon({
        code: "PCT20",
        discount: "20% off",
        type: "percentage",
      }),
      baseCoupon({ code: "FIX10", discount: "$10 off", type: "fixed" }),
    ];

    // 20% of $100 = $20 > $10 fixed
    const result = selectBestOffer(coupons, 100);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("PCT20");
    expect(result?.discountCents).toBe(2000);
  });

  it("breaks ties by source reliability", () => {
    const coupons: CouponResult[] = [
      baseCoupon({
        code: "DEAL1",
        discount: "$10 off",
        type: "fixed",
        source: "DealFinder",
      }),
      baseCoupon({
        code: "TECH1",
        discount: "$10 off",
        type: "fixed",
        source: "TechDeals",
      }),
    ];

    const result = selectBestOffer(coupons);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("TECH1");
  });

  it("breaks ties by expiration date", () => {
    const coupons: CouponResult[] = [
      baseCoupon({
        code: "SOON",
        discount: "$10 off",
        type: "fixed",
        source: "TechDeals",
        expiresAt: "2026-02-15T00:00:00.000Z",
      }),
      baseCoupon({
        code: "LATER",
        discount: "$10 off",
        type: "fixed",
        source: "TechDeals",
        expiresAt: "2026-04-01T00:00:00.000Z",
      }),
    ];

    const result = selectBestOffer(coupons);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("LATER");
  });

  it("generates meaningful selectionReasoning", () => {
    const coupons: CouponResult[] = [
      baseCoupon({
        code: "BEST",
        discount: "$25 off",
        type: "fixed",
        source: "TechDeals",
      }),
      baseCoupon({ code: "OK", discount: "$5 off", type: "fixed" }),
    ];

    const result = selectBestOffer(coupons);

    expect(result).not.toBeNull();
    expect(result?.selectionReasoning).toContain("BEST");
    expect(result?.selectionReasoning).toContain("$25 off");
    expect(result?.selectionReasoning).toContain("TechDeals");
    expect(result?.selectionReasoning).toContain("2 offers evaluated");
  });

  it("handles price_match type correctly", () => {
    const coupons: CouponResult[] = [
      baseCoupon({
        code: "PRICEMATCH",
        discount: "$15 off",
        type: "price_match",
      }),
      baseCoupon({ code: "FIX10", discount: "$10 off", type: "fixed" }),
    ];

    const result = selectBestOffer(coupons);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("PRICEMATCH");
    expect(result?.type).toBe("price_match");
    expect(result?.discountCents).toBe(1500);
  });

  it("selects price_match as best when it is the only result", () => {
    const coupons: CouponResult[] = [
      baseCoupon({
        code: "PRICEMATCH",
        discount: "$15 off",
        type: "price_match",
        source: "PriceWatch",
      }),
    ];

    const result = selectBestOffer(coupons);

    expect(result).not.toBeNull();
    expect(result?.code).toBe("PRICEMATCH");
    expect(result?.type).toBe("price_match");
    expect(result?.discountCents).toBe(1500);
    expect(result?.selectionReasoning).toContain("only offer available");
  });

  it("handles zero-value discounts", () => {
    const coupons: CouponResult[] = [
      baseCoupon({ code: "ZERO", discount: "$0 off", type: "fixed" }),
      baseCoupon({ code: "ZEROPCT", discount: "0% off", type: "percentage" }),
    ];

    const result = selectBestOffer(coupons);

    // Should still return something (zero discount is still a valid offer)
    expect(result).not.toBeNull();
    expect(result?.code).toBe("ZERO");
    expect(result?.discountCents).toBe(0);
  });
});
