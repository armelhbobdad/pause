import type { CouponResult } from "./coupon-provider";

export interface BestOffer {
  code: string;
  discount: string;
  /** Parsed numeric discount in cents. 0 when value is unknowable (e.g., percentage without price context). */
  discountCents: number;
  type: "percentage" | "fixed" | "price_match";
  source: string;
  expiresAt: string | null;
  selectionReasoning: string;
}

const DOLLAR_AMOUNT_PATTERN = /\$(\d+(?:\.\d+)?)/;
const PERCENT_AMOUNT_PATTERN = /(\d+(?:\.\d+)?)%/;

const SOURCE_RELIABILITY: Record<string, number> = {
  TechDeals: 4,
  FashionSaver: 3,
  DealFinder: 2,
  PriceWatch: 1,
};

function parseDiscountCents(coupon: CouponResult, price?: number): number {
  switch (coupon.type) {
    case "fixed":
    case "price_match": {
      const match = coupon.discount.match(DOLLAR_AMOUNT_PATTERN);
      return match ? Math.round(Number.parseFloat(match[1]) * 100) : 0;
    }
    case "percentage": {
      const match = coupon.discount.match(PERCENT_AMOUNT_PATTERN);
      if (!match) {
        return 0;
      }
      const pct = Number.parseFloat(match[1]);
      if (price !== undefined) {
        return Math.round(price * (pct / 100) * 100);
      }
      // No price: return negative to rank below fixed discounts
      return -1;
    }
    default: {
      return 0;
    }
  }
}

function getSourceReliability(source: string): number {
  return SOURCE_RELIABILITY[source] ?? 0;
}

function getExpiryTimestamp(expiresAt: string | null): number {
  if (!expiresAt) {
    return Number.MAX_SAFE_INTEGER;
  }
  return new Date(expiresAt).getTime();
}

export function selectBestOffer(
  coupons: CouponResult[],
  price?: number
): BestOffer | null {
  if (coupons.length === 0) {
    return null;
  }

  const scored = coupons.map((c) => ({
    coupon: c,
    cents: parseDiscountCents(c, price),
  }));

  scored.sort((a, b) => {
    // 1. Discount value DESC (highest first)
    if (a.cents !== b.cents) {
      return b.cents - a.cents;
    }
    // 2. Source reliability DESC
    const relA = getSourceReliability(a.coupon.source);
    const relB = getSourceReliability(b.coupon.source);
    if (relA !== relB) {
      return relB - relA;
    }
    // 3. Expiration ASC (furthest expiry = higher timestamp wins)
    const expA = getExpiryTimestamp(a.coupon.expiresAt);
    const expB = getExpiryTimestamp(b.coupon.expiresAt);
    return expB - expA;
  });

  const best = scored[0];
  const displayCents = best.cents < 0 ? 0 : best.cents;
  const reasoning =
    coupons.length === 1
      ? `Selected ${best.coupon.code} (${best.coupon.discount}) from ${best.coupon.source} — only offer available.`
      : `Selected ${best.coupon.code} (${best.coupon.discount}) from ${best.coupon.source} — top-ranked of ${coupons.length} offers evaluated.`;

  return {
    code: best.coupon.code,
    discount: best.coupon.discount,
    discountCents: displayCents,
    type: best.coupon.type,
    source: best.coupon.source,
    expiresAt: best.coupon.expiresAt,
    selectionReasoning: reasoning,
  };
}
