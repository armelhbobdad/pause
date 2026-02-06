import "server-only";
import { env } from "@pause/env/server";

export interface CouponResult {
  code: string;
  discount: string;
  type: "percentage" | "fixed" | "price_match";
  source: string;
  expiresAt: string | null;
}

interface SearchParams {
  merchant: string;
  category: string;
  productName?: string;
  price?: number;
}

function getExpiresAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

const MOCK_COUPONS: Record<string, Omit<CouponResult, "expiresAt">[]> = {
  electronics: [
    {
      code: "TECH20",
      discount: "20% off",
      type: "percentage",
      source: "TechDeals",
    },
    {
      code: "ELEC10",
      discount: "$10 off",
      type: "fixed",
      source: "DealFinder",
    },
    {
      code: "PRICEMATCH",
      discount: "$15 off",
      type: "price_match",
      source: "PriceWatch",
    },
  ],
  fashion: [
    {
      code: "STYLE15",
      discount: "15% off",
      type: "percentage",
      source: "FashionSaver",
    },
    {
      code: "TREND5",
      discount: "$5 off",
      type: "fixed",
      source: "DealFinder",
    },
  ],
  grocery: [],
};

const DEFAULT_COUPON: Omit<CouponResult, "expiresAt"> = {
  code: "SAVE10",
  discount: "$10 off",
  type: "fixed",
  source: "DealFinder",
};

async function mockSearch(params: SearchParams): Promise<CouponResult[]> {
  // Simulate real API latency (100-300ms)
  const delay = 100 + Math.random() * 200;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const category = params.category.toLowerCase();
  const templates =
    category in MOCK_COUPONS ? MOCK_COUPONS[category] : [DEFAULT_COUPON];
  return templates.map((c) => ({ ...c, expiresAt: getExpiresAt() }));
}

function realSearch(_params: SearchParams): CouponResult[] {
  console.warn(
    "[Guardian] Real coupon API not configured — returning empty results"
  );
  return [];
}

export async function searchCoupons(
  params: SearchParams
): Promise<CouponResult[]> {
  if (env.DEMO_MODE === "true") {
    return await mockSearch(params);
  }
  return realSearch(params);
}
