import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => ({
  mockSearchCoupons: vi.fn(),
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

import { searchCouponsTool } from "./coupon-search";

describe("coupon-search tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 6.8: execute handler catches provider errors and returns error object
  it("execute handler catches provider errors and returns error object instead of throwing", async () => {
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
      results: [],
      error: "Coupon search unavailable",
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Guardian] Coupon search failed:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });

  // Test: execute handler returns results on success
  it("execute handler returns results from provider on success", async () => {
    const mockResults = [
      {
        code: "TECH20",
        discount: "20% off",
        type: "percentage",
        source: "TechDeals",
        expiresAt: new Date().toISOString(),
      },
    ];
    mocks.mockSearchCoupons.mockResolvedValueOnce(mockResults);

    const executeHandler = (
      searchCouponsTool as unknown as {
        execute: (params: Record<string, unknown>) => Promise<unknown>;
      }
    ).execute;
    const result = await executeHandler({
      merchant: "BestBuy",
      category: "electronics",
    });

    expect(result).toEqual({ results: mockResults });
  });
});
