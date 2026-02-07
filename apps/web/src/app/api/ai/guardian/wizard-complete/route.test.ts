import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();

  return {
    session: null as { user: { id: string } } | null,
    interactionResult: [] as Array<{
      id: string;
      userId: string;
      status: string;
      outcome: string | null;
    }>,
    selectError: null as Error | null,
    updateError: null as Error | null,
    mockSelect,
    mockUpdate,
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
  mocks.mockUpdate.mockReturnValue(updateChain);

  return {
    db: {
      select: mocks.mockSelect,
      update: mocks.mockUpdate,
    },
  };
});

vi.mock("@pause/db/schema", () => ({
  interaction: {
    id: "interaction.id",
    userId: "interaction.userId",
    status: "interaction.status",
    outcome: "interaction.outcome",
    metadata: "interaction.metadata",
  },
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
  return new Request("http://localhost/api/ai/guardian/wizard-complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validResponses = [
  {
    step: 1,
    question: "What prompted this purchase desire?",
    answer: "Saw it on Instagram",
  },
  { step: 2, question: "How are you feeling right now?", answer: "Excited" },
  {
    step: 3,
    question: "What else could address that feeling?",
    answer: "Go for a walk",
  },
];

const validBody = {
  interactionId: "int-123",
  responses: validResponses,
  outcome: "wait",
};

describe("Wizard-Complete Route Handler", () => {
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
    mocks.selectError = null;
    mocks.updateError = null;

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
    mocks.mockUpdate.mockReturnValue(updateChain);
  });

  // ========================================================================
  // Authentication (AC#15)
  // ========================================================================

  it("returns 401 for unauthenticated request", async () => {
    mocks.session = null;
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(401);
  });

  // ========================================================================
  // Request Validation (AC#15)
  // ========================================================================

  it("returns 400 for missing interactionId", async () => {
    const response = await POST(
      createRequest({ responses: validResponses, outcome: "wait" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for missing responses array", async () => {
    const response = await POST(
      createRequest({ interactionId: "int-123", outcome: "wait" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for missing outcome", async () => {
    const response = await POST(
      createRequest({ interactionId: "int-123", responses: validResponses })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid outcome value", async () => {
    const response = await POST(
      createRequest({
        interactionId: "int-123",
        responses: validResponses,
        outcome: "invalid",
      })
    );
    expect(response.status).toBe(400);
  });

  // ========================================================================
  // Not Found (AC#15)
  // ========================================================================

  it("returns 404 for nonexistent interaction", async () => {
    mocks.interactionResult = [];
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(404);
  });

  // ========================================================================
  // Authorization (AC#15)
  // ========================================================================

  it("returns 403 for interaction belonging to different user", async () => {
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

  // ========================================================================
  // Idempotency Guard (AC#15)
  // ========================================================================

  it("returns 409 when interaction already has outcome", async () => {
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

    const data = await response.json();
    expect(data).toEqual({ error: "Interaction already has an outcome" });
  });

  // ========================================================================
  // Success — wait outcome (AC#6)
  // ========================================================================

  it('records outcome "wait" with wizard responses in metadata', async () => {
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true });

    // Verify update was called with correct outcome and metadata
    expect(mocks.mockUpdate).toHaveBeenCalled();
    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "wait",
        status: "feedback_received",
        metadata: { wizardResponses: validResponses },
      })
    );
  });

  // ========================================================================
  // Success — override outcome (AC#6)
  // ========================================================================

  it('records outcome "override" with wizard responses in metadata', async () => {
    const response = await POST(
      createRequest({ ...validBody, outcome: "override" })
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true });

    expect(mocks.mockUpdate).toHaveBeenCalled();
    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "overridden",
        status: "feedback_received",
        metadata: { wizardResponses: validResponses },
      })
    );
  });

  // ========================================================================
  // Success — wizard_bookmark outcome (AC#6)
  // ========================================================================

  it('records outcome "wizard_bookmark" with wizard responses in metadata', async () => {
    const response = await POST(
      createRequest({ ...validBody, outcome: "wizard_bookmark" })
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toEqual({ success: true });

    expect(mocks.mockUpdate).toHaveBeenCalled();
    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "wizard_bookmark",
        status: "feedback_received",
        metadata: { wizardResponses: validResponses },
      })
    );
  });

  // ========================================================================
  // Database Errors
  // ========================================================================

  it("handles database error on select gracefully", async () => {
    mocks.selectError = new Error("Operation timed out");
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(500);
  });

  it("handles database error on update gracefully", async () => {
    mocks.updateError = new Error("DB update failed");
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(500);
  });
});
