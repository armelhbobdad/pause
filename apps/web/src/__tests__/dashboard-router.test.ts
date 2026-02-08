import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  return {
    interactionCountResult: [{ count: 0 }] as Array<{ count: number }>,
    totalSavedResult: [{ totalCents: 0 }] as Array<{ totalCents: number }>,
    acceptanceRateResult: [{ rate: 0 }] as Array<{ rate: number | null }>,
    recentInteractionsResult: [] as Array<{
      id: string;
      tier: string;
      outcome: string | null;
      reasoningSummary: string | null;
      createdAt: Date;
      cardLastFour: string | null;
    }>,
    queryCallIndex: 0,
  };
});

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  // Build a chainable mock that resolves to different results
  // based on which query we're on (tracked by queryCallIndex)
  const createQueryBuilder = () => {
    const resolveCurrentQuery = () => {
      const idx = mocks.queryCallIndex++;
      switch (idx) {
        case 0:
          return mocks.interactionCountResult;
        case 1:
          return mocks.totalSavedResult;
        case 2:
          return mocks.acceptanceRateResult;
        case 3:
          return mocks.recentInteractionsResult;
        default:
          return [];
      }
    };

    const chainable: Record<string, unknown> = {};
    const methods = ["select", "from", "innerJoin", "leftJoin"];

    // All chainable methods return the proxy
    for (const method of methods) {
      chainable[method] = vi.fn().mockReturnValue(chainable);
    }

    // 'where' is the terminal for queries 0, 1, 2; for query 3 it chains to orderBy
    chainable.where = vi.fn().mockImplementation(() => {
      const idx = mocks.queryCallIndex;
      // Query 3 (recentInteractions) needs to chain to orderBy → limit
      if (idx === 3) {
        mocks.queryCallIndex++;
        return {
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(mocks.recentInteractionsResult),
          }),
        };
      }
      return resolveCurrentQuery();
    });

    chainable.orderBy = vi.fn().mockReturnValue(chainable);
    chainable.limit = vi.fn().mockImplementation(() => resolveCurrentQuery());

    return chainable;
  };

  return {
    db: createQueryBuilder(),
    schema: {
      interaction: {
        id: "interaction.id",
        userId: "interaction.userId",
        cardId: "interaction.cardId",
        tier: "interaction.tier",
        status: "interaction.status",
        outcome: "interaction.outcome",
        reasoningSummary: "interaction.reasoningSummary",
        createdAt: "interaction.createdAt",
      },
      card: {
        id: "card.id",
        lastFour: "card.lastFour",
      },
      savings: {
        interactionId: "savings.interactionId",
        amountCents: "savings.amountCents",
        applied: "savings.applied",
      },
    },
  };
});

// --- Mock drizzle-orm ---
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
    { raw: (s: string) => s }
  ),
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

describe("dashboardRouter", () => {
  beforeEach(() => {
    mocks.queryCallIndex = 0;
    mocks.interactionCountResult = [{ count: 0 }];
    mocks.totalSavedResult = [{ totalCents: 0 }];
    mocks.acceptanceRateResult = [{ rate: 0 }];
    mocks.recentInteractionsResult = [];
  });

  it("summary query returns correct aggregates", async () => {
    mocks.interactionCountResult = [{ count: 10 }];
    mocks.totalSavedResult = [{ totalCents: 5000 }];
    mocks.acceptanceRateResult = [{ rate: 75.0 }];
    mocks.recentInteractionsResult = [
      {
        id: "int-1",
        tier: "analyst",
        outcome: "accepted",
        reasoningSummary: "Low risk purchase",
        createdAt: new Date("2026-02-01"),
        cardLastFour: "1234",
      },
    ];

    const { dashboardRouter } = await import("@pause/api/routers/dashboard");
    const caller = dashboardRouter.createCaller({
      session: { user: { id: "user-1" }, session: { id: "sess-1" } },
    } as never);

    const result = await caller.summary();

    expect(result.interactionCount).toBe(10);
    expect(result.totalSavedCents).toBe(5000);
    expect(result.acceptanceRate).toBe(75.0);
    expect(result.recentInteractions).toHaveLength(1);
    expect(result.recentInteractions[0].tier).toBe("analyst");
  });

  it("empty user returns zeros and empty arrays", async () => {
    const { dashboardRouter } = await import("@pause/api/routers/dashboard");
    const caller = dashboardRouter.createCaller({
      session: { user: { id: "user-empty" }, session: { id: "sess-1" } },
    } as never);

    const result = await caller.summary();

    expect(result.interactionCount).toBe(0);
    expect(result.totalSavedCents).toBe(0);
    expect(result.acceptanceRate).toBe(0);
    expect(result.recentInteractions).toEqual([]);
  });

  it("auth check rejects unauthenticated requests", async () => {
    const { dashboardRouter } = await import("@pause/api/routers/dashboard");
    const caller = dashboardRouter.createCaller({
      session: null,
    } as never);

    await expect(caller.summary()).rejects.toThrow("Authentication required");
  });

  it("savings calculation uses cents correctly (no floating point)", async () => {
    mocks.interactionCountResult = [{ count: 3 }];
    mocks.totalSavedResult = [{ totalCents: 12_345 }];
    mocks.acceptanceRateResult = [{ rate: 100 }];
    mocks.recentInteractionsResult = [];

    const { dashboardRouter } = await import("@pause/api/routers/dashboard");
    const caller = dashboardRouter.createCaller({
      session: { user: { id: "user-cents" }, session: { id: "sess-1" } },
    } as never);

    const result = await caller.summary();

    expect(result.totalSavedCents).toBe(12_345);
    expect(Number.isInteger(result.totalSavedCents)).toBe(true);
  });

  it("returns interaction count from query (SQL excludes pending)", async () => {
    mocks.interactionCountResult = [{ count: 5 }];
    mocks.totalSavedResult = [{ totalCents: 0 }];
    mocks.acceptanceRateResult = [{ rate: 80 }];
    mocks.recentInteractionsResult = [];

    const { dashboardRouter } = await import("@pause/api/routers/dashboard");
    const caller = dashboardRouter.createCaller({
      session: { user: { id: "user-pending" }, session: { id: "sess-1" } },
    } as never);

    const result = await caller.summary();

    expect(result.interactionCount).toBe(5);
  });
});
