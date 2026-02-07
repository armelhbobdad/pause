import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockUpdateSet = vi.fn();

  return {
    session: null as { user: { id: string } } | null,
    selectResult: [] as Record<string, unknown>[],
    updateError: null as Error | null,
    mockSelect,
    mockUpdate,
    mockUpdateSet,
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

// --- Mock chains ---
function setupSelectChain() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve(mocks.selectResult)),
  };
  mocks.mockSelect.mockReturnValue(chain);
  return chain;
}

function setupUpdateChain() {
  mocks.mockUpdateSet.mockReturnThis();
  const chain = {
    set: mocks.mockUpdateSet,
    where: vi.fn(() => {
      if (mocks.updateError) {
        return Promise.reject(mocks.updateError);
      }
      return Promise.resolve();
    }),
  };
  mocks.mockUpdate.mockReturnValue(chain);
  return chain;
}

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  setupSelectChain();
  setupUpdateChain();
  return {
    db: {
      select: mocks.mockSelect,
      update: mocks.mockUpdate,
    },
  };
});

vi.mock("@pause/db/schema", () => ({
  ghostCard: {
    id: "ghost_card.id",
    userId: "ghost_card.userId",
    satisfactionFeedback: "ghost_card.satisfactionFeedback",
    status: "ghost_card.status",
  },
}));

vi.mock("@/lib/server/utils", () => ({
  withTimeout: vi.fn(<T>(promise: Promise<T>, _ms: number) => promise),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

// --- Import the route handler ---
import { PATCH } from "./route";

function createPatchRequest(
  body: unknown,
  url = "http://localhost/api/ai/ghost-cards/gc-1"
): Request {
  return new Request(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createParams(id = "gc-1"): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe("Ghost Cards PATCH Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1" } };
    mocks.selectResult = [{ id: "gc-1", userId: "user-1" }];
    mocks.updateError = null;
    setupSelectChain();
    setupUpdateChain();
  });

  // ========================================================================
  // Authentication (AC7)
  // ========================================================================

  it("returns 401 for unauthenticated request", async () => {
    mocks.session = null;
    const response = await PATCH(
      createPatchRequest({ satisfactionFeedback: "worth_it" }),
      { params: createParams() }
    );
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: "Unauthorized" });
  });

  // ========================================================================
  // Validation (AC7)
  // ========================================================================

  it("returns 400 for invalid satisfaction value", async () => {
    const response = await PATCH(
      createPatchRequest({ satisfactionFeedback: "invalid" }),
      { params: createParams() }
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "Invalid request body" });
  });

  it("returns 400 for missing satisfactionFeedback field", async () => {
    const response = await PATCH(createPatchRequest({}), {
      params: createParams(),
    });
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "Invalid request body" });
  });

  // ========================================================================
  // Not Found (AC7)
  // ========================================================================

  it("returns 404 when ghost card does not exist", async () => {
    mocks.selectResult = [];
    const response = await PATCH(
      createPatchRequest({ satisfactionFeedback: "worth_it" }),
      { params: createParams("nonexistent") }
    );
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: "Ghost card not found" });
  });

  // ========================================================================
  // Ownership (AC7)
  // ========================================================================

  it("returns 403 when ghost card belongs to different user", async () => {
    mocks.selectResult = [{ id: "gc-1", userId: "other-user" }];
    const response = await PATCH(
      createPatchRequest({ satisfactionFeedback: "worth_it" }),
      { params: createParams() }
    );
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual({ error: "Forbidden" });
  });

  // ========================================================================
  // Successful Update (AC2, AC3, AC4, AC7)
  // ========================================================================

  it("updates satisfaction feedback and returns success", async () => {
    const response = await PATCH(
      createPatchRequest({ satisfactionFeedback: "worth_it" }),
      { params: createParams() }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      success: true,
      ghostCardId: "gc-1",
      satisfactionFeedback: "worth_it",
    });
  });

  it("sets status to feedback_given on update", async () => {
    await PATCH(createPatchRequest({ satisfactionFeedback: "regret_it" }), {
      params: createParams(),
    });

    expect(mocks.mockUpdateSet).toHaveBeenCalledWith({
      satisfactionFeedback: "regret_it",
      status: "feedback_given",
    });
  });

  // ========================================================================
  // Upsert — re-submission (AC6)
  // ========================================================================

  it("allows re-submitting satisfaction feedback (upsert)", async () => {
    // First submission
    const response1 = await PATCH(
      createPatchRequest({ satisfactionFeedback: "worth_it" }),
      { params: createParams() }
    );
    expect(response1.status).toBe(200);

    // Second submission (change of mind)
    const response2 = await PATCH(
      createPatchRequest({ satisfactionFeedback: "regret_it" }),
      { params: createParams() }
    );
    expect(response2.status).toBe(200);
    const data = await response2.json();
    expect(data.satisfactionFeedback).toBe("regret_it");
  });

  // ========================================================================
  // Database Error (AC7)
  // ========================================================================

  it("returns 500 on database update error", async () => {
    mocks.updateError = new Error("Connection refused");
    const response = await PATCH(
      createPatchRequest({ satisfactionFeedback: "worth_it" }),
      { params: createParams() }
    );
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "Failed to update ghost card" });
  });
});
