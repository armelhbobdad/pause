import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  return {
    aggregateResult: [{ totalCents: 0, dealCount: 0, avgCents: 0 }] as Array<{
      totalCents: number | null;
      dealCount: number;
      avgCents: number | null;
    }>,
    sourceBreakdownResult: [] as Array<{
      source: string | null;
      totalCents: number | null;
      count: number;
    }>,
    queryCallIndex: 0,
  };
});

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  const createQueryBuilder = () => {
    const resolveCurrentQuery = () => {
      const idx = mocks.queryCallIndex++;
      switch (idx) {
        case 0:
          return mocks.aggregateResult;
        case 1:
          return mocks.sourceBreakdownResult;
        default:
          return [];
      }
    };

    const chainable: Record<string, unknown> = {};
    const methods = ["select", "from", "innerJoin"];

    for (const method of methods) {
      chainable[method] = vi.fn().mockReturnValue(chainable);
    }

    // 'where' is terminal for query 0 (aggregates); for query 1 it chains to groupBy
    chainable.where = vi.fn().mockImplementation(() => {
      const idx = mocks.queryCallIndex;
      if (idx === 1) {
        mocks.queryCallIndex++;
        return {
          groupBy: vi.fn().mockReturnValue(mocks.sourceBreakdownResult),
        };
      }
      return resolveCurrentQuery();
    });

    chainable.groupBy = vi.fn().mockImplementation(() => resolveCurrentQuery());

    return chainable;
  };

  return {
    db: createQueryBuilder(),
    schema: {
      interaction: {
        id: "interaction.id",
        userId: "interaction.userId",
      },
      savings: {
        id: "savings.id",
        interactionId: "savings.interactionId",
        amountCents: "savings.amountCents",
        applied: "savings.applied",
        source: "savings.source",
      },
    },
  };
});

// --- Mock drizzle-orm ---
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  sum: vi.fn((col: unknown) => ({
    type: "sum",
    col,
    mapWith: vi.fn(() => ({ type: "sum_mapped", col })),
  })),
  count: vi.fn((col: unknown) => ({ type: "count", col })),
  avg: vi.fn((col: unknown) => ({
    type: "avg",
    col,
    mapWith: vi.fn(() => ({ type: "avg_mapped", col })),
  })),
}));

// --- Mock @pause/auth ---
vi.mock("@pause/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

// --- Mock @pause/env/server ---
vi.mock("@pause/env/server", () => ({
  databaseUrl: "postgresql://mock",
}));

// --- Mock @neondatabase/serverless ---
vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => vi.fn()),
  neonConfig: {},
}));

// --- Mock ws ---
vi.mock("ws", () => ({ default: vi.fn() }));

describe("savingsRouter", () => {
  beforeEach(() => {
    mocks.queryCallIndex = 0;
    mocks.aggregateResult = [{ totalCents: 0, dealCount: 0, avgCents: 0 }];
    mocks.sourceBreakdownResult = [];
  });

  it("getSummary returns correct aggregates", async () => {
    mocks.aggregateResult = [
      { totalCents: 6200, dealCount: 2, avgCents: 3100 },
    ];
    mocks.sourceBreakdownResult = [
      { source: "TechDeals", totalCents: 4200, count: 1 },
      { source: "RetailCo", totalCents: 2000, count: 1 },
    ];

    const { savingsRouter } = await import("@pause/api/routers/savings");
    const caller = savingsRouter.createCaller({
      session: { user: { id: "user-1" }, session: { id: "sess-1" } },
    } as never);

    const result = await caller.getSummary();

    expect(result.totalCents).toBe(6200);
    expect(result.dealCount).toBe(2);
    expect(result.avgCents).toBe(3100);
    expect(result.sourceBreakdown).toHaveLength(2);
    expect(result.sourceBreakdown[0].source).toBe("TechDeals");
    expect(result.sourceBreakdown[0].totalCents).toBe(4200);
  });

  it("empty user returns zeros and empty breakdown", async () => {
    const { savingsRouter } = await import("@pause/api/routers/savings");
    const caller = savingsRouter.createCaller({
      session: { user: { id: "user-empty" }, session: { id: "sess-1" } },
    } as never);

    const result = await caller.getSummary();

    expect(result.totalCents).toBe(0);
    expect(result.dealCount).toBe(0);
    expect(result.avgCents).toBe(0);
    expect(result.sourceBreakdown).toEqual([]);
  });

  it("auth check rejects unauthenticated requests", async () => {
    const { savingsRouter } = await import("@pause/api/routers/savings");
    const caller = savingsRouter.createCaller({
      session: null,
    } as never);

    await expect(caller.getSummary()).rejects.toThrow(
      "Authentication required"
    );
  });

  it("handles null source in breakdown gracefully", async () => {
    mocks.aggregateResult = [
      { totalCents: 1000, dealCount: 1, avgCents: 1000 },
    ];
    mocks.sourceBreakdownResult = [
      { source: null, totalCents: 1000, count: 1 },
    ];

    const { savingsRouter } = await import("@pause/api/routers/savings");
    const caller = savingsRouter.createCaller({
      session: { user: { id: "user-null" }, session: { id: "sess-1" } },
    } as never);

    const result = await caller.getSummary();

    expect(result.sourceBreakdown[0].source).toBe("Unknown");
  });

  it("rounds average cents to integer", async () => {
    mocks.aggregateResult = [
      { totalCents: 5000, dealCount: 3, avgCents: 1666.67 },
    ];
    mocks.sourceBreakdownResult = [];

    const { savingsRouter } = await import("@pause/api/routers/savings");
    const caller = savingsRouter.createCaller({
      session: { user: { id: "user-avg" }, session: { id: "sess-1" } },
    } as never);

    const result = await caller.getSummary();

    expect(Number.isInteger(result.avgCents)).toBe(true);
    expect(result.avgCents).toBe(1667);
  });

  it("handles null aggregate results (no applied savings)", async () => {
    mocks.aggregateResult = [
      { totalCents: null, dealCount: 0, avgCents: null },
    ];
    mocks.sourceBreakdownResult = [];

    const { savingsRouter } = await import("@pause/api/routers/savings");
    const caller = savingsRouter.createCaller({
      session: { user: { id: "user-none" }, session: { id: "sess-1" } },
    } as never);

    const result = await caller.getSummary();

    expect(result.totalCents).toBe(0);
    expect(result.avgCents).toBe(0);
  });
});
