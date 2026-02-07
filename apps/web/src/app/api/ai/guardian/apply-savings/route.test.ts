import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockTransaction = vi.fn();

  return {
    session: null as { user: { id: string } } | null,
    interactionResult: [] as Array<{
      id: string;
      userId: string;
      status: string;
      outcome: string | null;
    }>,
    insertError: null as Error | null,
    updateError: null as Error | null,
    selectError: null as Error | null,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockTransaction,
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

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(() => {
      if (mocks.selectError) {
        return Promise.reject(mocks.selectError);
      }
      return Promise.resolve(mocks.interactionResult);
    }),
  };

  const insertChain = {
    values: vi.fn(() => {
      if (mocks.insertError) {
        return Promise.reject(mocks.insertError);
      }
      return Promise.resolve();
    }),
  };

  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn(() => {
      if (mocks.updateError) {
        return Promise.reject(mocks.updateError);
      }
      return Promise.resolve();
    }),
  };

  mocks.mockSelect.mockReturnValue(selectChain);
  mocks.mockInsert.mockReturnValue(insertChain);
  mocks.mockUpdate.mockReturnValue(updateChain);
  mocks.mockTransaction.mockImplementation(async (fn) => {
    await fn({ insert: mocks.mockInsert, update: mocks.mockUpdate });
  });

  return {
    db: {
      select: mocks.mockSelect,
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
      transaction: mocks.mockTransaction,
    },
  };
});

vi.mock("@pause/db/schema", () => ({
  interaction: {
    id: "interaction.id",
    userId: "interaction.userId",
    status: "interaction.status",
    outcome: "interaction.outcome",
  },
  savings: { id: "savings.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((col: unknown) => ({ isNull: col })),
}));

vi.mock("@/lib/server/utils", () => ({
  withTimeout: vi.fn(<T>(promise: Promise<T>, _ms: number) => promise),
}));

// --- Import the route handler ---
import { POST } from "./route";

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/ai/guardian/apply-savings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  interactionId: "int-123",
  couponCode: "SAVE20",
  amountCents: 2000,
  source: "TestStore",
};

describe("Apply Savings Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1" } };
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "user-1",
        status: "completed",
        outcome: null,
      },
    ];
    mocks.insertError = null;
    mocks.updateError = null;
    mocks.selectError = null;

    // Re-setup mock chains after clearAllMocks
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(() => {
        if (mocks.selectError) {
          return Promise.reject(mocks.selectError);
        }
        return Promise.resolve(mocks.interactionResult);
      }),
    };
    const insertChain = {
      values: vi.fn(() => {
        if (mocks.insertError) {
          return Promise.reject(mocks.insertError);
        }
        return Promise.resolve();
      }),
    };
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn(() => {
        if (mocks.updateError) {
          return Promise.reject(mocks.updateError);
        }
        return Promise.resolve();
      }),
    };

    mocks.mockSelect.mockReturnValue(selectChain);
    mocks.mockInsert.mockReturnValue(insertChain);
    mocks.mockUpdate.mockReturnValue(updateChain);
    mocks.mockTransaction.mockImplementation(async (fn) => {
      await fn({ insert: mocks.mockInsert, update: mocks.mockUpdate });
    });
  });

  // ========================================================================
  // Authentication
  // ========================================================================

  it("returns 401 for unauthenticated request", async () => {
    mocks.session = null;
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(401);
  });

  // ========================================================================
  // Request Validation
  // ========================================================================

  it("returns 400 for invalid request body", async () => {
    const response = await POST(createRequest({ invalid: true }));
    expect(response.status).toBe(400);
  });

  it("returns 400 for missing interactionId", async () => {
    const response = await POST(
      createRequest({ amountCents: 2000, source: "Store" })
    );
    expect(response.status).toBe(400);
  });

  // ========================================================================
  // Authorization
  // ========================================================================

  it("returns 403 for interaction not belonging to user", async () => {
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "other-user",
        status: "completed",
        outcome: null,
      },
    ];
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(403);
  });

  it("returns 403 when interaction not found", async () => {
    mocks.interactionResult = [];
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(403);
  });

  // ========================================================================
  // Status Guard
  // ========================================================================

  it("returns 409 when interaction status is not completed", async () => {
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "user-1",
        status: "pending",
        outcome: null,
      },
    ];
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(409);
  });

  // ========================================================================
  // Success Case
  // ========================================================================

  it("successfully inserts savings record and updates interaction outcome", async () => {
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true });

    // Verify insert was called
    expect(mocks.mockInsert).toHaveBeenCalled();
    const insertReturn = mocks.mockInsert.mock.results[0]?.value;
    expect(insertReturn?.values).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionId: "int-123",
        amountCents: 2000,
        couponCode: "SAVE20",
        source: "TestStore",
        applied: true,
      })
    );

    // Verify update was called
    expect(mocks.mockUpdate).toHaveBeenCalled();
    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "accepted",
        status: "feedback_received",
      })
    );
  });

  // ========================================================================
  // Idempotency Guard
  // ========================================================================

  it("returns 409 when interaction already has outcome set", async () => {
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "user-1",
        status: "completed",
        outcome: "accepted",
      },
    ];
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(409);
  });

  // ========================================================================
  // Database Errors
  // ========================================================================

  it("handles database timeout on select gracefully", async () => {
    mocks.selectError = new Error("Operation timed out");
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(500);
  });

  it("handles database error on insert gracefully", async () => {
    mocks.insertError = new Error("DB insert failed");
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(500);
  });
});
