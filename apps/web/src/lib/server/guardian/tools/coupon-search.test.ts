import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => ({
  mockSearchCoupons: vi.fn(),
  mockSelectBestOffer: vi.fn(),
}));

// --- Mock server-only ---
vi.mock("server-only", () => ({}));

// --- Mock AI SDK tool function ---
vi.mock("ai", () => ({
  tool: vi.fn((def: unknown) => def),
}));

// --- Mock Zod (passthrough) ---
vi.mock("zod", () => {
  const describe = vi.fn().mockReturnThis();
  return {
    default: {
      object: vi.fn(() => ({})),
      string: vi.fn(() => ({
        describe,
        optional: vi.fn(() => ({ describe })),
      })),
      number: vi.fn(() => ({
        describe,
        optional: vi.fn(() => ({ describe })),
      })),
    },
  };
});

// --- Mock coupon provider ---
vi.mock("./coupon-provider", () => ({
  searchCoupons: mocks.mockSearchCoupons,
}));

// --- Mock offer selection ---
vi.mock("./offer-selection", () => ({
  selectBestOffer: mocks.mockSelectBestOffer,
}));

import { searchCouponsTool } from "./coupon-search";

describe("coupon-search tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("execute handler returns bestOffer from selectBestOffer on success", async () => {
    const mockResults = [
      {
        code: "TECH20",
        discount: "20% off",
        type: "percentage",
        source: "TechDeals",
        expiresAt: new Date().toISOString(),
      },
    ];
    const mockBestOffer = {
      code: "TECH20",
      discount: "20% off",
      discountCents: 2000,
      type: "percentage",
      source: "TechDeals",
      expiresAt: new Date().toISOString(),
      selectionReasoning: "Selected TECH20 (20% off) from TechDeals",
    };
    mocks.mockSearchCoupons.mockResolvedValueOnce(mockResults);
    mocks.mockSelectBestOffer.mockReturnValueOnce(mockBestOffer);

    const executeHandler = (
      searchCouponsTool as unknown as {
        execute: (params: Record<string, unknown>) => Promise<unknown>;
      }
    ).execute;
    const result = await executeHandler({
      merchant: "BestBuy",
      category: "electronics",
      price: 100,
    });

    expect(result).toEqual({
      bestOffer: mockBestOffer,
      allResultsCount: 1,
      selectionReasoning: "Selected TECH20 (20% off) from TechDeals",
    });
    expect(mocks.mockSelectBestOffer).toHaveBeenCalledWith(mockResults, 100);
  });

  it("execute handler returns null bestOffer on provider error", async () => {
    mocks.mockSearchCoupons.mockRejectedValueOnce(
      new Error("Provider timeout")
    );
    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const executeHandler = (
      searchCouponsTool as unknown as {
        execute: (params: Record<string, unknown>) => Promise<unknown>;
      }
    ).execute;
    const result = await executeHandler({
      merchant: "BestBuy",
      category: "electronics",
    });

    expect(result).toEqual({
      bestOffer: null,
      allResultsCount: 0,
      selectionReasoning: "Coupon search unavailable",
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Guardian] Coupon search failed:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
