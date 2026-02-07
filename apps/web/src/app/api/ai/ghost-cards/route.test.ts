import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInnerJoin = vi.fn();

  return {
    session: null as { user: { id: string } } | null,
    queryResult: [] as Record<string, unknown>[],
    queryError: null as Error | null,
    mockSelect,
    mockInnerJoin,
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
    innerJoin: vi.fn().mockReturnThis(),
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
  ghostCard: {
    id: "ghost_card.id",
    userId: "ghost_card.userId",
    interactionId: "ghost_card.interactionId",
    status: "ghost_card.status",
    satisfactionFeedback: "ghost_card.satisfactionFeedback",
    createdAt: "ghost_card.createdAt",
  },
  interaction: {
    id: "interaction.id",
    tier: "interaction.tier",
    outcome: "interaction.outcome",
    metadata: "interaction.metadata",
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
  url = "http://localhost/api/ai/ghost-cards"
): Request {
  return new Request(url, { method: "GET" });
}

describe("Ghost Cards API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1" } };
    mocks.queryResult = [];
    mocks.queryError = null;
    setupMockChains();
  });

  // ========================================================================
  // Authentication (AC9)
  // ========================================================================

  it("returns 401 for unauthenticated request", async () => {
    mocks.session = null;
    const response = await GET(createGetRequest());
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: "Unauthorized" });
  });

  // ========================================================================
  // Successful Response (AC9)
  // ========================================================================

  it("returns ghost cards with correct shape", async () => {
    mocks.queryResult = [
      {
        id: "gc-1",
        interactionId: "int-1",
        status: "pending",
        satisfactionFeedback: null,
        createdAt: new Date("2026-02-07T12:00:00Z"),
        tier: "negotiator",
        outcome: "accepted",
        metadata: {
          purchaseContext: {
            itemName: "Headphones",
            price: 180,
            merchant: "BestBuy",
          },
        },
      },
    ];

    const response = await GET(createGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.cards).toHaveLength(1);
    expect(data.cards[0]).toEqual({
      id: "gc-1",
      interactionId: "int-1",
      status: "pending",
      satisfactionFeedback: null,
      createdAt: "2026-02-07T12:00:00.000Z",
      tier: "negotiator",
      outcome: "accepted",
      purchaseContext: {
        itemName: "Headphones",
        price: 180,
        merchant: "BestBuy",
      },
    });
    expect(data.nextCursor).toBeNull();
  });

  // ========================================================================
  // Empty State (AC9)
  // ========================================================================

  it("returns empty array when user has no ghost cards", async () => {
    mocks.queryResult = [];

    const response = await GET(createGetRequest());
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data).toEqual({ cards: [], nextCursor: null });
  });

  // ========================================================================
  // Null Metadata Handling
  // ========================================================================

  it("returns null purchaseContext when interaction metadata is null", async () => {
    mocks.queryResult = [
      {
        id: "gc-2",
        interactionId: "int-2",
        status: "viewed",
        satisfactionFeedback: null,
        createdAt: new Date("2026-02-07T10:00:00Z"),
        tier: "therapist",
        outcome: "wait",
        metadata: null,
      },
    ];

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.cards[0].purchaseContext).toBeNull();
    expect(data.cards[0].satisfactionFeedback).toBeNull();
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
  // Malformed Cursor Handling
  // ========================================================================

  it("ignores malformed cursor and returns results", async () => {
    mocks.queryResult = [];
    const response = await GET(
      createGetRequest(
        "http://localhost/api/ai/ghost-cards?cursor=invalid-no-pipe"
      )
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ cards: [], nextCursor: null });
  });

  // ========================================================================
  // Pagination (AC9)
  // ========================================================================

  it("returns nextCursor when more results exist", async () => {
    // 11 results means there are more (PAGE_SIZE=10, we fetch PAGE_SIZE+1)
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: `gc-${i}`,
      interactionId: `int-${i}`,
      status: "pending",
      createdAt: new Date(
        `2026-02-07T${String(12 - i).padStart(2, "0")}:00:00Z`
      ),
      tier: "negotiator",
      outcome: "accepted",
      metadata: null,
    }));

    mocks.queryResult = rows;

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.cards).toHaveLength(10);
    expect(data.nextCursor).toBeTruthy();
    expect(data.nextCursor).toContain("|gc-9");
  });
});
