import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();

  return {
    session: null as { user: { id: string } } | null,
    queryResult: [] as Record<string, unknown>[],
    queryError: null as Error | null,
    mockSelect,
  };
});

// --- Mock server-only ---
vi.mock("server-only", () => ({}));

// --- Mock next/headers ---
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

// --- Mock @pause/auth ---
vi.mock("@pause/auth", () => ({
  auth: {
    api: {
      getSession: () => Promise.resolve(mocks.session),
    },
  },
}));

// --- Shared mock chain ---
function setupMockChains() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(() => {
      if (mocks.queryError) {
        return Promise.reject(mocks.queryError);
      }
      return Promise.resolve(mocks.queryResult);
    }),
  };

  mocks.mockSelect.mockReturnValue(chain);
  return chain;
}

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  setupMockChains();
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
    tier: "interaction.tier",
    outcome: "interaction.outcome",
    reasoningSummary: "interaction.reasoningSummary",
    metadata: "interaction.metadata",
    createdAt: "interaction.createdAt",
  },
  savings: {
    interactionId: "savings.interactionId",
    amountCents: "savings.amountCents",
    couponCode: "savings.couponCode",
  },
}));

vi.mock("@/lib/server/utils", () => ({
  withTimeout: vi.fn(<T>(promise: Promise<T>, _ms: number) => promise),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  desc: vi.fn((col: unknown) => ({ desc: col })),
  lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
  or: vi.fn((...args: unknown[]) => ({ or: args })),
}));

// --- Import the route handler ---
import { GET } from "./route";

function createGetRequest(
  url = "http://localhost/api/ai/interactions"
): Request {
  return new Request(url, { method: "GET" });
}

function makeInteractionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "int-1",
    tier: "analyst",
    outcome: "accepted",
    reasoningSummary: "Low risk purchase",
    metadata: null,
    createdAt: new Date("2026-02-07T12:00:00Z"),
    savingsAmountCents: null,
    couponCode: null,
    ...overrides,
  };
}

describe("Interactions API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1" } };
    mocks.queryResult = [];
    mocks.queryError = null;
    setupMockChains();
  });

  // ========================================================================
  // Authentication (AC6)
  // ========================================================================

  it("returns 401 for unauthenticated request", async () => {
    mocks.session = null;
    const response = await GET(createGetRequest());
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: "Unauthorized" });
  });

  it("returns 200 for authenticated request", async () => {
    mocks.queryResult = [];
    const response = await GET(createGetRequest());
    expect(response.status).toBe(200);
  });

  // ========================================================================
  // Response Shape (AC1, AC6)
  // ========================================================================

  it("returns interactions with correct shape", async () => {
    mocks.queryResult = [
      makeInteractionRow({
        metadata: {
          purchaseContext: {
            itemName: "Headphones",
            price: 180,
            merchant: "BestBuy",
            category: "Electronics",
          },
        },
      }),
    ];

    const response = await GET(createGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.interactions).toHaveLength(1);
    expect(data.interactions[0]).toEqual({
      id: "int-1",
      tier: "analyst",
      outcome: "accepted",
      reasoningSummary: "Low risk purchase",
      createdAt: "2026-02-07T12:00:00.000Z",
      savingsAmountCents: null,
      couponCode: null,
      purchaseContext: {
        itemName: "Headphones",
        price: 180,
        merchant: "BestBuy",
        category: "Electronics",
      },
    });
    expect(data.nextCursor).toBeNull();
  });

  it("returns savings data when available", async () => {
    mocks.queryResult = [
      makeInteractionRow({
        id: "int-2",
        tier: "negotiator",
        savingsAmountCents: 1500,
        couponCode: "SAVE15",
      }),
    ];

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions[0].savingsAmountCents).toBe(1500);
    expect(data.interactions[0].couponCode).toBe("SAVE15");
  });

  // ========================================================================
  // Empty State (AC5)
  // ========================================================================

  it("returns empty array when user has no interactions", async () => {
    mocks.queryResult = [];

    const response = await GET(createGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toEqual({ interactions: [], nextCursor: null });
  });

  // ========================================================================
  // Null Metadata Handling
  // ========================================================================

  it("returns null purchaseContext when metadata is null", async () => {
    mocks.queryResult = [makeInteractionRow({ metadata: null })];

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions[0].purchaseContext).toBeNull();
  });

  it("returns null reasoningSummary when not provided", async () => {
    mocks.queryResult = [makeInteractionRow({ reasoningSummary: null })];

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions[0].reasoningSummary).toBeNull();
  });

  // ========================================================================
  // Database Error Handling
  // ========================================================================

  it("returns 500 on database error", async () => {
    mocks.queryError = new Error("Connection refused");
    const response = await GET(createGetRequest());
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "Database error" });
  });

  // ========================================================================
  // Cursor Pagination (AC3, AC6)
  // ========================================================================

  it("returns nextCursor when more results exist", async () => {
    const rows = Array.from({ length: 11 }, (_, i) =>
      makeInteractionRow({
        id: `int-${i}`,
        createdAt: new Date(
          `2026-02-07T${String(12 - i).padStart(2, "0")}:00:00Z`
        ),
      })
    );
    mocks.queryResult = rows;

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions).toHaveLength(10);
    expect(data.nextCursor).toBeTruthy();
    expect(data.nextCursor).toContain("|int-9");
  });

  it("returns null nextCursor when no more results", async () => {
    mocks.queryResult = [makeInteractionRow()];

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions).toHaveLength(1);
    expect(data.nextCursor).toBeNull();
  });

  it("handles cursor parameter correctly", async () => {
    mocks.queryResult = [];
    const response = await GET(
      createGetRequest(
        "http://localhost/api/ai/interactions?cursor=2026-02-07T10:00:00.000Z|int-5"
      )
    );
    expect(response.status).toBe(200);
  });

  it("ignores malformed cursor and returns results", async () => {
    mocks.queryResult = [];
    const response = await GET(
      createGetRequest(
        "http://localhost/api/ai/interactions?cursor=invalid-no-pipe"
      )
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ interactions: [], nextCursor: null });
  });

  it("ignores cursor with invalid date", async () => {
    mocks.queryResult = [];
    const response = await GET(
      createGetRequest(
        "http://localhost/api/ai/interactions?cursor=not-a-date|some-id"
      )
    );
    expect(response.status).toBe(200);
  });

  // ========================================================================
  // Tier Filter (AC6)
  // ========================================================================

  it("accepts tier filter parameter", async () => {
    mocks.queryResult = [];
    const response = await GET(
      createGetRequest("http://localhost/api/ai/interactions?tier=negotiator")
    );
    expect(response.status).toBe(200);
  });

  it("ignores invalid tier filter", async () => {
    mocks.queryResult = [];
    const response = await GET(
      createGetRequest("http://localhost/api/ai/interactions?tier=invalid")
    );
    expect(response.status).toBe(200);
  });

  // ========================================================================
  // Outcome Filter (AC6)
  // ========================================================================

  it("accepts outcome filter parameter", async () => {
    mocks.queryResult = [];
    const response = await GET(
      createGetRequest("http://localhost/api/ai/interactions?outcome=accepted")
    );
    expect(response.status).toBe(200);
  });

  it("ignores invalid outcome filter", async () => {
    mocks.queryResult = [];
    const response = await GET(
      createGetRequest("http://localhost/api/ai/interactions?outcome=invalid")
    );
    expect(response.status).toBe(200);
  });

  // ========================================================================
  // Combined Filters (AC6)
  // ========================================================================

  it("accepts both tier and outcome filters", async () => {
    mocks.queryResult = [];
    const response = await GET(
      createGetRequest(
        "http://localhost/api/ai/interactions?tier=therapist&outcome=wait"
      )
    );
    expect(response.status).toBe(200);
  });

  // ========================================================================
  // Multiple Interactions
  // ========================================================================

  it("returns multiple interactions in correct order", async () => {
    mocks.queryResult = [
      makeInteractionRow({
        id: "int-1",
        createdAt: new Date("2026-02-07T12:00:00Z"),
      }),
      makeInteractionRow({
        id: "int-2",
        createdAt: new Date("2026-02-07T10:00:00Z"),
      }),
    ];

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions).toHaveLength(2);
    expect(data.interactions[0].id).toBe("int-1");
    expect(data.interactions[1].id).toBe("int-2");
  });

  // ========================================================================
  // All Outcome Types
  // ========================================================================

  it("handles all outcome types correctly", async () => {
    const outcomes = [
      "accepted",
      "overridden",
      "abandoned",
      "timeout",
      "auto_approved",
      "break_glass",
      "wait",
      "wizard_bookmark",
      "wizard_abandoned",
    ];

    for (const outcome of outcomes) {
      mocks.queryResult = [makeInteractionRow({ outcome })];
      setupMockChains();
      const response = await GET(createGetRequest());
      const data = await response.json();
      expect(data.interactions[0].outcome).toBe(outcome);
    }
  });

  // ========================================================================
  // All Tier Types
  // ========================================================================

  it("handles all tier types correctly", async () => {
    const tiers = ["analyst", "negotiator", "therapist"];

    for (const tier of tiers) {
      mocks.queryResult = [makeInteractionRow({ tier })];
      setupMockChains();
      const response = await GET(createGetRequest());
      const data = await response.json();
      expect(data.interactions[0].tier).toBe(tier);
    }
  });

  // ========================================================================
  // Null Outcome
  // ========================================================================

  it("handles null outcome (pending interaction)", async () => {
    mocks.queryResult = [makeInteractionRow({ outcome: null })];

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions[0].outcome).toBeNull();
  });

  // ========================================================================
  // Purchase Context Partial Data
  // ========================================================================

  it("handles partial purchase context", async () => {
    mocks.queryResult = [
      makeInteractionRow({
        metadata: {
          purchaseContext: { merchant: "Amazon" },
        },
      }),
    ];

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions[0].purchaseContext).toEqual({
      merchant: "Amazon",
      itemName: undefined,
      price: undefined,
      category: undefined,
    });
  });

  // ========================================================================
  // Savings null values
  // ========================================================================

  it("returns null savings fields when no savings exist", async () => {
    mocks.queryResult = [
      makeInteractionRow({
        savingsAmountCents: null,
        couponCode: null,
      }),
    ];

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions[0].savingsAmountCents).toBeNull();
    expect(data.interactions[0].couponCode).toBeNull();
  });

  // ========================================================================
  // Exactly PAGE_SIZE results (no more)
  // ========================================================================

  it("returns no nextCursor for exactly PAGE_SIZE results", async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeInteractionRow({
        id: `int-${i}`,
        createdAt: new Date(
          `2026-02-07T${String(12 - i).padStart(2, "0")}:00:00Z`
        ),
      })
    );
    mocks.queryResult = rows;

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.interactions).toHaveLength(10);
    expect(data.nextCursor).toBeNull();
  });
});
