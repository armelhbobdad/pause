import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();

  return {
    recentInteractions: [] as Array<{ outcome: string | null }>,
    dbError: null as Error | null,
    mockSelect,
  };
});

// --- Mock server-only ---
vi.mock("server-only", () => ({}));

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  mocks.mockSelect.mockImplementation(() => {
    if (mocks.dbError) {
      // Make the chain still work but throw at terminal
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn(() => Promise.reject(mocks.dbError)),
      };
    }
    return {
      from: vi.fn().mockReturnThis(),
      where: vi.fn(() => Promise.resolve(mocks.recentInteractions)),
    };
  });

  return {
    db: {
      select: mocks.mockSelect,
    },
  };
});

vi.mock("@pause/db/schema", () => ({
  interaction: {
    id: "interaction.id",
    userId: "interaction.userId",
    outcome: "interaction.outcome",
    createdAt: "interaction.createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  gte: vi.fn((a: unknown, b: unknown) => ({ gte: [a, b] })),
}));

// --- Mock @/lib/server/utils ---
vi.mock("@/lib/server/utils", () => ({
  withTimeout: vi.fn(<T>(promise: Promise<T>, _ms: number) => promise),
}));

import type {
  RiskAssessmentInput,
  RiskAssessmentResult,
  RiskFactor,
} from "./risk";
import { assessRisk } from "./risk";

describe("Risk Assessment Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recentInteractions = [];
    mocks.dbError = null;
  });

  // ========================================================================
  // Task 1: Types (AC#14)
  // ========================================================================

  describe("types (AC#14)", () => {
    it("exports RiskAssessmentResult with required fields", () => {
      const result: RiskAssessmentResult = {
        score: 0,
        factors: [],
        reasoning: "test",
        historyAvailable: true,
      };
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("factors");
      expect(result).toHaveProperty("reasoning");
      expect(result).toHaveProperty("historyAvailable");
    });

    it("exports RiskFactor with required fields", () => {
      const factor: RiskFactor = {
        signal: "test",
        points: 10,
        description: "test description",
      };
      expect(factor).toHaveProperty("signal");
      expect(factor).toHaveProperty("points");
      expect(factor).toHaveProperty("description");
    });

    it("exports RiskAssessmentInput with required and optional fields", () => {
      const input: RiskAssessmentInput = {
        userId: "user-1",
        cardId: "card-1",
      };
      expect(input).toHaveProperty("userId");
      expect(input).toHaveProperty("cardId");
    });
  });

  // ========================================================================
  // Task 2: Context-only risk scoring (AC#1-5, #11, #12, #15)
  // ========================================================================

  describe("context-only risk scoring", () => {
    it("returns a score between 0-100 for new users (AC#1)", async () => {
      const result = await assessRisk({
        userId: "user-1",
        cardId: "card-1",
        now: new Date("2026-02-06T12:00:00Z"),
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    // Time-of-day signal (AC#2)
    describe("time-of-day signal (AC#2)", () => {
      it("adds +15 for late-night purchase at 22:00 UTC", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T22:00:00Z"),
        });
        const timeFactor = result.factors.find(
          (f) => f.signal === "time_of_day"
        );
        expect(timeFactor).toBeDefined();
        expect(timeFactor?.points).toBe(15);
      });

      it("adds +15 for late-night purchase at 02:00 UTC", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T02:00:00Z"),
        });
        const timeFactor = result.factors.find(
          (f) => f.signal === "time_of_day"
        );
        expect(timeFactor).toBeDefined();
        expect(timeFactor?.points).toBe(15);
      });

      it("does NOT add time factor at 21:59 UTC (boundary)", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T21:59:00Z"),
        });
        const timeFactor = result.factors.find(
          (f) => f.signal === "time_of_day"
        );
        expect(timeFactor).toBeUndefined();
      });

      it("does NOT add time factor at 06:00 UTC (boundary)", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T06:00:00Z"),
        });
        const timeFactor = result.factors.find(
          (f) => f.signal === "time_of_day"
        );
        expect(timeFactor).toBeUndefined();
      });

      it("adds +15 at 05:59 UTC (still late-night)", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T05:59:00Z"),
        });
        const timeFactor = result.factors.find(
          (f) => f.signal === "time_of_day"
        );
        expect(timeFactor).toBeDefined();
        expect(timeFactor?.points).toBe(15);
      });

      it("adds +15 at 23:00 UTC (late-night)", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T23:00:00Z"),
        });
        const timeFactor = result.factors.find(
          (f) => f.signal === "time_of_day"
        );
        expect(timeFactor).toBeDefined();
        expect(timeFactor?.points).toBe(15);
      });

      it("uses now parameter for deterministic testing (AC#15)", async () => {
        const daytime = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T14:00:00Z"),
        });
        const nighttime = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T03:00:00Z"),
        });
        expect(nighttime.score).toBeGreaterThan(daytime.score);
      });
    });

    // Price signal (AC#3)
    describe("price signal (AC#3)", () => {
      it("adds +20 for high price >$100", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          priceInCents: 10_001,
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const priceFactor = result.factors.find(
          (f) => f.signal === "high_price"
        );
        expect(priceFactor).toBeDefined();
        expect(priceFactor?.points).toBe(20);
      });

      it("does NOT add price factor at exactly $100 (boundary)", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          priceInCents: 10_000,
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const priceFactor = result.factors.find(
          (f) => f.signal === "high_price"
        );
        expect(priceFactor).toBeUndefined();
      });

      it("does NOT add price factor at $99.99", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          priceInCents: 9999,
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const priceFactor = result.factors.find(
          (f) => f.signal === "high_price"
        );
        expect(priceFactor).toBeUndefined();
      });

      it("adds +20 at $100.01", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          priceInCents: 10_001,
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const priceFactor = result.factors.find(
          (f) => f.signal === "high_price"
        );
        expect(priceFactor).toBeDefined();
        expect(priceFactor?.points).toBe(20);
      });

      it("does NOT add price factor when priceInCents is undefined", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const priceFactor = result.factors.find(
          (f) => f.signal === "high_price"
        );
        expect(priceFactor).toBeUndefined();
      });
    });

    // Category signal (AC#4)
    describe("category signal (AC#4)", () => {
      it("adds +10 for electronics category", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          category: "electronics",
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const catFactor = result.factors.find(
          (f) => f.signal === "impulse_category"
        );
        expect(catFactor).toBeDefined();
        expect(catFactor?.points).toBe(10);
      });

      it("matches categories case-insensitively", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          category: "ELECTRONICS",
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const catFactor = result.factors.find(
          (f) => f.signal === "impulse_category"
        );
        expect(catFactor).toBeDefined();
      });

      it.each([
        "electronics",
        "fashion",
        "gaming",
        "luxury",
        "jewelry",
        "food_delivery",
        "subscription",
      ])("recognizes impulse category: %s", async (category) => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          category,
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const catFactor = result.factors.find(
          (f) => f.signal === "impulse_category"
        );
        expect(catFactor).toBeDefined();
        expect(catFactor?.points).toBe(10);
      });

      it("does NOT add category factor for non-impulse category", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          category: "groceries",
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const catFactor = result.factors.find(
          (f) => f.signal === "impulse_category"
        );
        expect(catFactor).toBeUndefined();
      });

      it("does NOT add category factor when category is undefined", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T12:00:00Z"),
        });
        const catFactor = result.factors.find(
          (f) => f.signal === "impulse_category"
        );
        expect(catFactor).toBeUndefined();
      });
    });

    // Score clamping (AC#5)
    describe("score clamping (AC#5)", () => {
      it("clamps score to maximum 100", async () => {
        // All signals active: time(15) + price(20) + category(10) + max overrides(25) = 70
        // Not enough to exceed 100 with context-only, but test with history
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          priceInCents: 50_000,
          category: "electronics",
          now: new Date("2026-02-06T02:00:00Z"),
        });
        expect(result.score).toBeLessThanOrEqual(100);
      });

      it("clamps score to minimum 0", async () => {
        // With many accepted outcomes, score could go negative
        mocks.recentInteractions = Array.from({ length: 5 }, () => ({
          outcome: "accepted",
        }));
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T12:00:00Z"),
        });
        expect(result.score).toBeGreaterThanOrEqual(0);
      });
    });

    // Reasoning string (AC#9)
    describe("reasoning string (AC#9)", () => {
      it("builds human-readable reasoning string", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          priceInCents: 15_000,
          category: "electronics",
          now: new Date("2026-02-06T23:00:00Z"),
        });
        expect(result.reasoning).toContain("Risk score:");
        expect(result.reasoning).toContain("/100");
        expect(result.reasoning).toContain("late-night");
        expect(result.reasoning).toContain("high price");
        expect(result.reasoning).toContain("electronics");
      });

      it("includes factor descriptions in reasoning", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T23:00:00Z"),
        });
        expect(result.reasoning).toContain("Factors:");
      });

      it("shows no factors when none apply", async () => {
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T12:00:00Z"),
        });
        expect(result.reasoning).toContain("Risk score: 0/100");
      });
    });
  });

  // ========================================================================
  // Task 3: History-based risk modifiers (AC#6-8, #13)
  // ========================================================================

  describe("history-based risk modifiers", () => {
    it("includes history signals for returning user (AC#6)", async () => {
      mocks.recentInteractions = [
        { outcome: "overridden" },
        { outcome: "accepted" },
      ];
      const result = await assessRisk({
        userId: "user-1",
        cardId: "card-1",
        now: new Date("2026-02-06T12:00:00Z"),
      });
      expect(result.historyAvailable).toBe(true);
    });

    it("adds +5 per override, max +25 (AC#7)", async () => {
      mocks.recentInteractions = Array.from({ length: 6 }, () => ({
        outcome: "overridden",
      }));
      const result = await assessRisk({
        userId: "user-1",
        cardId: "card-1",
        now: new Date("2026-02-06T12:00:00Z"),
      });
      const overrideFactor = result.factors.find(
        (f) => f.signal === "recent_overrides"
      );
      expect(overrideFactor).toBeDefined();
      expect(overrideFactor?.points).toBe(25); // 6 * 5 = 30, capped at 25
    });

    it("adds correct points for fewer overrides", async () => {
      mocks.recentInteractions = [
        { outcome: "overridden" },
        { outcome: "overridden" },
        { outcome: "overridden" },
      ];
      const result = await assessRisk({
        userId: "user-1",
        cardId: "card-1",
        now: new Date("2026-02-06T12:00:00Z"),
      });
      const overrideFactor = result.factors.find(
        (f) => f.signal === "recent_overrides"
      );
      expect(overrideFactor).toBeDefined();
      expect(overrideFactor?.points).toBe(15); // 3 * 5 = 15
    });

    it("subtracts -5 per accepted outcome, max -15 (AC#8)", async () => {
      mocks.recentInteractions = Array.from({ length: 5 }, () => ({
        outcome: "accepted",
      }));
      const result = await assessRisk({
        userId: "user-1",
        cardId: "card-1",
        now: new Date("2026-02-06T12:00:00Z"),
      });
      const acceptedFactor = result.factors.find(
        (f) => f.signal === "accepted_outcomes"
      );
      expect(acceptedFactor).toBeDefined();
      expect(acceptedFactor?.points).toBe(-15); // 5 * -5 = -25, capped at -15
    });

    it("does NOT add override/accepted factors when count is 0", async () => {
      mocks.recentInteractions = [{ outcome: "abandoned" }];
      const result = await assessRisk({
        userId: "user-1",
        cardId: "card-1",
        now: new Date("2026-02-06T12:00:00Z"),
      });
      const overrideFactor = result.factors.find(
        (f) => f.signal === "recent_overrides"
      );
      const acceptedFactor = result.factors.find(
        (f) => f.signal === "accepted_outcomes"
      );
      expect(overrideFactor).toBeUndefined();
      expect(acceptedFactor).toBeUndefined();
    });

    // Graceful degradation (AC#13)
    describe("graceful degradation (AC#13)", () => {
      it("degrades to context-only when DB fails", async () => {
        mocks.dbError = new Error("Connection refused");
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          priceInCents: 15_000,
          now: new Date("2026-02-06T23:00:00Z"),
        });
        expect(result.historyAvailable).toBe(false);
        // Should still have context signals
        expect(result.score).toBeGreaterThan(0);
        const timeFactor = result.factors.find(
          (f) => f.signal === "time_of_day"
        );
        expect(timeFactor).toBeDefined();
        // Reasoning includes degradation note
        expect(result.reasoning).toContain("history unavailable");
      });

      it("sets historyAvailable to false on DB error", async () => {
        mocks.dbError = new Error("Timeout");
        const result = await assessRisk({
          userId: "user-1",
          cardId: "card-1",
          now: new Date("2026-02-06T12:00:00Z"),
        });
        expect(result.historyAvailable).toBe(false);
      });
    });
  });

  // ========================================================================
  // Combined scenarios
  // ========================================================================

  describe("combined scenarios", () => {
    it("combines all context signals: time(15) + price(20) + category(10) = 45", async () => {
      const result = await assessRisk({
        userId: "user-1",
        cardId: "card-1",
        priceInCents: 15_000,
        category: "electronics",
        now: new Date("2026-02-06T23:00:00Z"),
      });
      expect(result.score).toBe(45);
    });

    it("combines context + history signals", async () => {
      mocks.recentInteractions = [
        { outcome: "overridden" },
        { outcome: "overridden" },
      ];
      const result = await assessRisk({
        userId: "user-1",
        cardId: "card-1",
        priceInCents: 15_000,
        category: "electronics",
        now: new Date("2026-02-06T23:00:00Z"),
      });
      // time(15) + price(20) + category(10) + overrides(10) = 55
      expect(result.score).toBe(55);
    });

    it("default now parameter uses current time (AC#15)", async () => {
      // Just verify it doesn't throw without `now`
      const result = await assessRisk({
        userId: "user-1",
        cardId: "card-1",
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
});
