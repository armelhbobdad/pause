import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => ({
  demoMode: "true" as string,
}));

// --- Mock server-only ---
vi.mock("server-only", () => ({}));

// --- Mock @pause/env/server ---
vi.mock("@pause/env/server", () => ({
  env: {
    get DEMO_MODE() {
      return mocks.demoMode;
    },
  },
}));

// Import after mocks
import { searchCoupons } from "./coupon-provider";

describe("coupon-provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.demoMode = "true";
  });

  // Test 6.1: DEMO_MODE=true returns mock coupons for electronics
  it("returns mock coupons for electronics category in demo mode", async () => {
    const results = await searchCoupons({
      merchant: "BestBuy",
      category: "electronics",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toEqual(
      expect.objectContaining({
        code: "TECH20",
        discount: "20% off",
        type: "percentage",
        source: "TechDeals",
      })
    );
  });

  // Test 6.2: DEMO_MODE=true returns empty array for grocery
  it("returns empty array for grocery category in demo mode", async () => {
    const results = await searchCoupons({
      merchant: "Walmart",
      category: "grocery",
    });

    expect(results).toEqual([]);
  });

  // Test 6.3: DEMO_MODE=false returns empty array
  it("returns empty array when DEMO_MODE is false", async () => {
    mocks.demoMode = "false";
    const consoleSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const results = await searchCoupons({
      merchant: "BestBuy",
      category: "electronics",
    });

    expect(results).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Real coupon API not configured")
    );

    consoleSpy.mockRestore();
  });

  // Test 6.4: Mock coupons have valid expiresAt dates (7 days in future)
  it("mock coupons have expiresAt set to 7 days in future", async () => {
    const results = await searchCoupons({
      merchant: "BestBuy",
      category: "electronics",
    });

    expect(results.length).toBeGreaterThan(0);
    const expiresAt = new Date(results[0].expiresAt as string);
    const now = new Date();
    const sixDaysFromNow = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);

    expect(expiresAt.getTime()).toBeGreaterThan(sixDaysFromNow.getTime());
  });

  // Test: default category returns SAVE10 fixed coupon
  it("returns default SAVE10 coupon for unknown categories in demo mode", async () => {
    const results = await searchCoupons({
      merchant: "RandomStore",
      category: "automotive",
    });

    expect(results.length).toBe(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        code: "SAVE10",
        discount: "$10 off",
        type: "fixed",
        source: "DealFinder",
      })
    );
  });

  // Test: fashion category returns multiple coupons
  it("returns fashion coupons for fashion category in demo mode", async () => {
    const results = await searchCoupons({
      merchant: "Zara",
      category: "fashion",
    });

    expect(results.length).toBe(2);
    expect(results[0]).toEqual(
      expect.objectContaining({
        code: "STYLE15",
        discount: "15% off",
        type: "percentage",
        source: "FashionSaver",
      })
    );
    expect(results[1]).toEqual(
      expect.objectContaining({
        code: "TREND5",
        discount: "$5 off",
        type: "fixed",
        source: "DealFinder",
      })
    );
  });

  // Test: electronics category returns 3 coupons including price_match
  it("returns 3 coupons for electronics including price_match type", async () => {
    const results = await searchCoupons({
      merchant: "BestBuy",
      category: "electronics",
    });

    expect(results.length).toBe(3);
    const types = results.map((r) => r.type);
    expect(types).toContain("percentage");
    expect(types).toContain("fixed");
    expect(types).toContain("price_match");
  });
});
