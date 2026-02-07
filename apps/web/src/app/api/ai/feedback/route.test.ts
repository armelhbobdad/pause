import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockAfterCallbacks: Array<() => Promise<void>> = [];
  const mockRunReflection = vi.fn();
  const mockAttachReflectionToTrace = vi.fn();
  const mockMarkLearningComplete = vi.fn();

  return {
    session: null as { user: { id: string } } | null,
    interactionResult: [] as Array<{
      id: string;
      userId: string;
      status: string;
      outcome: string | null;
      metadata: Record<string, unknown> | null;
      reasoningSummary: string | null;
      tier: string;
    }>,
    selectError: null as Error | null,
    updateError: null as Error | null,
    mockSelect,
    mockUpdate,
    mockAfterCallbacks,
    mockRunReflection,
    mockAttachReflectionToTrace,
    mockMarkLearningComplete,
  };
});

// --- Mock server-only ---
vi.mock("server-only", () => ({}));

// --- Mock next/headers ---
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

// --- Mock next/server with after() capture ---
vi.mock("next/server", () => ({
  after: vi.fn((cb: () => Promise<void>) => {
    mocks.mockAfterCallbacks.push(cb);
  }),
}));

// --- Mock @pause/auth ---
vi.mock("@pause/auth", () => ({
  auth: {
    api: {
      getSession: () => Promise.resolve(mocks.session),
    },
  },
}));

// --- Shared mock chain setup (used by vi.mock factory and beforeEach) ---
function setupMockChains() {
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
}

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  setupMockChains();
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
    reasoningSummary: "interaction.reasoningSummary",
    tier: "interaction.tier",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

vi.mock("@/lib/server/utils", () => ({
  withTimeout: vi.fn(<T>(promise: Promise<T>, _ms: number) => promise),
}));

// --- Mock learning module ---
vi.mock("@/lib/server/learning", () => ({
  runReflection: mocks.mockRunReflection,
  attachReflectionToTrace: mocks.mockAttachReflectionToTrace,
  markLearningComplete: mocks.mockMarkLearningComplete,
}));

// --- Import the route handler ---
import { POST } from "./route";

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/ai/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  interactionId: "int-123",
  outcome: "accepted",
};

describe("Feedback Recording Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1" } };
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "user-1",
        status: "completed",
        outcome: null,
        metadata: null,
        reasoningSummary: "Consider waiting for a better deal",
        tier: "negotiator",
      },
    ];
    mocks.selectError = null;
    mocks.updateError = null;
    mocks.mockAfterCallbacks.length = 0;
    mocks.mockRunReflection.mockResolvedValue(null);
    mocks.mockAttachReflectionToTrace.mockResolvedValue(undefined);
    mocks.mockMarkLearningComplete.mockResolvedValue(undefined);
    setupMockChains();
  });

  // ========================================================================
  // Authentication (AC2)
  // ========================================================================

  it("returns 401 for unauthenticated request", async () => {
    mocks.session = null;
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data).toEqual({ error: "Unauthorized" });
  });

  // ========================================================================
  // Request Validation (AC1)
  // ========================================================================

  it("returns 400 for missing interactionId", async () => {
    const response = await POST(createRequest({ outcome: "accepted" }));
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "Invalid request body" });
  });

  it("returns 400 for invalid outcome value", async () => {
    const response = await POST(
      createRequest({ interactionId: "int-123", outcome: "invalid_outcome" })
    );
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "Invalid request body" });
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/ai/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data).toEqual({ error: "Invalid JSON" });
  });

  // ========================================================================
  // Interaction Lookup (AC3)
  // ========================================================================

  it("returns 404 when interaction not found", async () => {
    mocks.interactionResult = [];
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data).toEqual({ error: "Interaction not found" });
  });

  // ========================================================================
  // Authorization Guard (AC4)
  // ========================================================================

  it("returns 403 when interaction belongs to different user", async () => {
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "other-user",
        status: "completed",
        outcome: null,
        metadata: null,
        reasoningSummary: null,
        tier: "analyst",
      },
    ];
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual({ error: "Forbidden" });
  });

  // ========================================================================
  // Success — First Feedback (AC6, AC7)
  // ========================================================================

  it("returns 200 with feedbackId for first-time feedback", async () => {
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      success: true,
      feedbackId: "int-123",
    });
  });

  it("maps outcome 'override' to DB enum 'overridden'", async () => {
    const response = await POST(
      createRequest({ interactionId: "int-123", outcome: "override" })
    );
    expect(response.status).toBe(200);

    expect(mocks.mockUpdate).toHaveBeenCalled();
    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "overridden" })
    );
  });

  it("maps outcome 'skipped_savings' to DB enum 'overridden'", async () => {
    const response = await POST(
      createRequest({ interactionId: "int-123", outcome: "skipped_savings" })
    );
    expect(response.status).toBe(200);

    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "overridden" })
    );
  });

  it("maps outcome 'accepted_savings' to DB enum 'accepted'", async () => {
    const response = await POST(
      createRequest({ interactionId: "int-123", outcome: "accepted_savings" })
    );
    expect(response.status).toBe(200);

    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "accepted" })
    );
  });

  it("maps outcome 'wait' to DB enum 'wait'", async () => {
    const response = await POST(
      createRequest({ interactionId: "int-123", outcome: "wait" })
    );
    expect(response.status).toBe(200);

    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "wait" })
    );
  });

  it("maps outcome 'abandoned' to DB enum 'abandoned'", async () => {
    const response = await POST(
      createRequest({ interactionId: "int-123", outcome: "abandoned" })
    );
    expect(response.status).toBe(200);

    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "abandoned" })
    );
  });

  it("sets status to 'feedback_received' on update", async () => {
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(200);

    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "feedback_received" })
    );
  });

  // ========================================================================
  // Upsert — Existing Outcome (AC5)
  // ========================================================================

  it("returns 200 with updated:true when outcome already existed", async () => {
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "user-1",
        status: "feedback_received",
        outcome: "accepted",
        metadata: null,
        reasoningSummary: "test",
        tier: "negotiator",
      },
    ];
    const response = await POST(
      createRequest({ interactionId: "int-123", outcome: "override" })
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      success: true,
      feedbackId: "int-123",
      updated: true,
    });
  });

  // ========================================================================
  // Metadata Merge (AC8)
  // ========================================================================

  it("stores metadata when no existing metadata", async () => {
    const response = await POST(
      createRequest({
        interactionId: "int-123",
        outcome: "accepted",
        metadata: { reason: "good deal" },
      })
    );
    expect(response.status).toBe(200);

    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { reason: "good deal" },
      })
    );
  });

  it("merges metadata with existing metadata", async () => {
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "user-1",
        status: "completed",
        outcome: null,
        metadata: { existingKey: "existingValue" },
        reasoningSummary: "test",
        tier: "negotiator",
      },
    ];
    const response = await POST(
      createRequest({
        interactionId: "int-123",
        outcome: "accepted",
        metadata: { newKey: "newValue" },
      })
    );
    expect(response.status).toBe(200);

    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { existingKey: "existingValue", newKey: "newValue" },
      })
    );
  });

  it("preserves existing metadata when no new metadata provided", async () => {
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "user-1",
        status: "completed",
        outcome: null,
        metadata: { existingKey: "existingValue" },
        reasoningSummary: "test",
        tier: "negotiator",
      },
    ];
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(200);

    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { existingKey: "existingValue" },
      })
    );
  });

  it("treats empty metadata object as no metadata", async () => {
    mocks.interactionResult = [
      {
        id: "int-123",
        userId: "user-1",
        status: "completed",
        outcome: null,
        metadata: { existingKey: "existingValue" },
        reasoningSummary: "test",
        tier: "negotiator",
      },
    ];
    const response = await POST(
      createRequest({
        interactionId: "int-123",
        outcome: "accepted",
        metadata: {},
      })
    );
    expect(response.status).toBe(200);

    const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
    expect(updateReturn?.set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { existingKey: "existingValue" },
      })
    );
  });

  // ========================================================================
  // Database Errors (500)
  // ========================================================================

  it("returns 500 on database select error", async () => {
    mocks.selectError = new Error("Operation timed out");
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "Database error" });
  });

  it("returns 500 on database update error", async () => {
    mocks.updateError = new Error("DB update failed");
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "Failed to update interaction" });
  });

  // ========================================================================
  // Story 6.2: Learning Pipeline after() Integration
  // ========================================================================

  describe("Learning Pipeline after() (Story 6.2)", () => {
    it("registers after() callback for learnable outcomes", async () => {
      await POST(createRequest(validBody));

      expect(mocks.mockAfterCallbacks).toHaveLength(1);
    });

    it("registers after() for all client outcomes (all map to learnable DB values)", async () => {
      // All client outcomes in this route map to learnable DB outcomes.
      // Non-learnable outcomes (auto_approved, break_glass, timeout) are set
      // by the Guardian route directly, not via this feedback route.
      await POST(createRequest(validBody));
      expect(mocks.mockAfterCallbacks).toHaveLength(1);
    });

    it("calls runReflection with correct parameters in after()", async () => {
      mocks.interactionResult = [
        {
          id: "int-123",
          userId: "user-1",
          status: "completed",
          outcome: null,
          metadata: { purchaseContext: "buying new headphones" },
          reasoningSummary: "Consider waiting for a sale",
          tier: "negotiator",
        },
      ];

      await POST(createRequest(validBody));

      // Execute the after() callback
      expect(mocks.mockAfterCallbacks).toHaveLength(1);
      await mocks.mockAfterCallbacks[0]();

      expect(mocks.mockRunReflection).toHaveBeenCalledWith({
        interactionId: "int-123",
        userId: "user-1",
        question: "buying new headphones",
        generatorAnswer: "Consider waiting for a sale",
        outcome: "accepted",
      });
    });

    it("uses 'unlock request' as fallback when no purchaseContext in metadata", async () => {
      await POST(createRequest(validBody));
      await mocks.mockAfterCallbacks[0]();

      expect(mocks.mockRunReflection).toHaveBeenCalledWith(
        expect.objectContaining({
          question: "unlock request",
        })
      );
    });

    it("uses empty string for generatorAnswer when reasoningSummary is null", async () => {
      mocks.interactionResult = [
        {
          id: "int-123",
          userId: "user-1",
          status: "completed",
          outcome: null,
          metadata: null,
          reasoningSummary: null,
          tier: "negotiator",
        },
      ];

      await POST(createRequest(validBody));
      await mocks.mockAfterCallbacks[0]();

      expect(mocks.mockRunReflection).toHaveBeenCalledWith(
        expect.objectContaining({
          generatorAnswer: "",
        })
      );
    });

    it("calls attachReflectionToTrace and markLearningComplete on success", async () => {
      const reflectionOutput = {
        analysis: "Good outcome",
        helpful_skill_ids: ["s1"],
        harmful_skill_ids: [],
        new_learnings: [],
      };
      mocks.mockRunReflection.mockResolvedValue({
        reflectionOutput,
        interactionId: "int-123",
        userId: "user-1",
      });

      await POST(createRequest(validBody));
      await mocks.mockAfterCallbacks[0]();

      expect(mocks.mockAttachReflectionToTrace).toHaveBeenCalledWith(
        "int-123",
        reflectionOutput
      );
      expect(mocks.mockMarkLearningComplete).toHaveBeenCalledWith("int-123");
    });

    it("does not call markLearningComplete when runReflection returns null", async () => {
      mocks.mockRunReflection.mockResolvedValue(null);

      await POST(createRequest(validBody));
      await mocks.mockAfterCallbacks[0]();

      expect(mocks.mockMarkLearningComplete).not.toHaveBeenCalled();
    });

    it("handles attachReflectionToTrace failure gracefully", async () => {
      mocks.mockRunReflection.mockResolvedValue({
        reflectionOutput: { analysis: "test" },
        interactionId: "int-123",
        userId: "user-1",
      });
      mocks.mockAttachReflectionToTrace.mockRejectedValue(
        new Error("Opik error")
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      await POST(createRequest(validBody));
      // Should not throw
      await mocks.mockAfterCallbacks[0]();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Opik trace attachment failed"),
        expect.any(Error)
      );
      // markLearningComplete should still be called
      expect(mocks.mockMarkLearningComplete).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("handles markLearningComplete failure gracefully", async () => {
      mocks.mockRunReflection.mockResolvedValue({
        reflectionOutput: { analysis: "test" },
        interactionId: "int-123",
        userId: "user-1",
      });
      mocks.mockMarkLearningComplete.mockRejectedValue(
        new Error("DB update error")
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      await POST(createRequest(validBody));
      // Should not throw
      await mocks.mockAfterCallbacks[0]();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Status update failed"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
