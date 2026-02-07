import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockAfter = vi.fn();
  const mockSearchCoupons = vi.fn();

  const mockCreateBannedTermFilter = vi.fn(
    (_onReplacements: (r: unknown[]) => void) =>
      vi.fn(() => new TransformStream())
  );

  return {
    session: null as { user: { id: string } } | null,
    cardResult: [] as Array<{ id: string; userId: string }>,
    insertError: null as Error | null,
    streamResult: {
      toUIMessageStreamResponse: () =>
        new Response("stream-body", {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      text: Promise.resolve("mock response text") as Promise<string>,
    },
    streamTextError: null as Error | null,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockAfter,
    mockSearchCoupons,
    mockCreateBannedTermFilter,
  };
});

// --- Mock server-only (prevents "This module cannot be imported from a Client Component module" error) ---
vi.mock("server-only", () => ({}));

// --- Mock next/headers ---
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

// --- Mock next/server ---
vi.mock("next/server", () => ({
  after: mocks.mockAfter,
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
    limit: vi.fn(() => Promise.resolve(mocks.cardResult)),
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
    where: vi.fn(() => Promise.resolve()),
  };

  mocks.mockSelect.mockReturnValue(selectChain);
  mocks.mockInsert.mockReturnValue(insertChain);
  mocks.mockUpdate.mockReturnValue(updateChain);

  return {
    db: {
      select: mocks.mockSelect,
      insert: mocks.mockInsert,
      update: mocks.mockUpdate,
    },
  };
});

vi.mock("@pause/db/schema", () => ({
  card: { id: "card.id", userId: "card.userId" },
  interaction: { id: "interaction.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
}));

// --- Mock AI SDK ---
vi.mock("ai", () => ({
  convertToModelMessages: vi.fn((msgs: unknown) => Promise.resolve(msgs)),
  streamText: vi.fn(() => {
    if (mocks.streamTextError) {
      throw mocks.streamTextError;
    }
    return mocks.streamResult;
  }),
  stepCountIs: vi.fn((n: number) => ({ type: "stepCount", count: n })),
  tool: vi.fn((def: unknown) => def),
}));

// --- Mock tool-names (shared type) ---
vi.mock("@/lib/guardian/tool-names", () => ({
  TOOL_NAMES: {
    SEARCH_COUPONS: "search_coupons",
    PRESENT_REFLECTION: "present_reflection",
    SHOW_WAIT_OPTION: "show_wait_option",
  },
}));

// --- Mock coupon search tool ---
vi.mock("@/lib/server/guardian/tools/coupon-search", () => ({
  searchCouponsTool: {
    description:
      "Search for applicable deals, coupons, or promo codes for a purchase",
    inputSchema: {},
    execute: mocks.mockSearchCoupons,
  },
}));

// --- Mock reflection tool ---
vi.mock("@/lib/server/guardian/tools/reflection-prompt", () => ({
  presentReflectionTool: {
    description: "Present a reflective question",
    inputSchema: {},
    execute: vi.fn(),
  },
}));

// --- Mock wait option tool ---
vi.mock("@/lib/server/guardian/tools/wait-option", () => ({
  showWaitOptionTool: {
    description: "Offer a wait period",
    inputSchema: {},
    execute: vi.fn(),
  },
}));

// --- Mock banned term filter ---
vi.mock("@/lib/server/guardian/filters", () => ({
  createBannedTermFilter: mocks.mockCreateBannedTermFilter,
}));

// --- Mock coupon provider ---
vi.mock("@/lib/server/guardian/tools/coupon-provider", () => ({
  searchCoupons: mocks.mockSearchCoupons,
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-gemini-model"),
}));

// --- Mock server-side Guardian utilities ---
vi.mock("@/lib/server/utils", () => ({
  withTimeout: vi.fn(<T>(promise: Promise<T>, _ms: number) => promise),
}));

vi.mock("@/lib/server/guardian/risk", () => ({
  assessRisk: vi.fn(() =>
    Promise.resolve({
      score: 10,
      factors: [],
      reasoning: "test",
      historyAvailable: true,
    })
  ),
}));

vi.mock("@/lib/server/ace", () => ({
  loadUserSkillbook: vi.fn(async () => ""),
}));

vi.mock("@/lib/server/opik", () => ({
  getGuardianTelemetry: vi.fn((id: string) => ({
    isEnabled: true,
    metadata: { interactionId: id },
  })),
  logDegradationTrace: vi.fn(),
}));

vi.mock("@/lib/server/guardian/prompts/analyst", () => ({
  ANALYST_SYSTEM_PROMPT: "You are a test analyst prompt.",
}));

vi.mock("@/lib/server/guardian/prompts/negotiator", () => ({
  NEGOTIATOR_SYSTEM_PROMPT: "You are a test negotiator prompt.",
}));

vi.mock("@/lib/server/guardian/prompts/therapist", () => ({
  THERAPIST_SYSTEM_PROMPT: "You are a test therapist prompt.",
}));

vi.mock("@/lib/server/guardian/tiers", () => {
  const realDetermineTier = (score: number) => {
    if (score >= 70) {
      return "therapist";
    }
    if (score >= 30) {
      return "negotiator";
    }
    return "analyst";
  };
  return {
    determineTier: vi.fn((score: number) => realDetermineTier(score)),
  };
});

// --- Import the route handler ---
import { maxDuration, POST, runtime } from "./route";

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/ai/guardian", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const UUID_REGEX = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/;
const ELLIPSIS_SUFFIX_REGEX = /\.\.\.$/;

const validBody = {
  messages: [{ role: "user", content: "test", id: "msg-1" }],
  cardId: "card-123",
};

describe("Guardian Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1" } };
    mocks.cardResult = [{ id: "card-123", userId: "user-1" }];
    mocks.insertError = null;
    mocks.streamTextError = null;
    mocks.streamResult.text = Promise.resolve("mock response text");

    // Re-setup mock chains after clearAllMocks
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve(mocks.cardResult)),
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
      where: vi.fn(() => Promise.resolve()),
    };

    mocks.mockSelect.mockReturnValue(selectChain);
    mocks.mockInsert.mockReturnValue(insertChain);
    mocks.mockUpdate.mockReturnValue(updateChain);
  });

  // ========================================================================
  // Module exports
  // ========================================================================

  describe("module exports", () => {
    it("exports runtime as nodejs (AC#4)", () => {
      expect(runtime).toBe("nodejs");
    });

    it("exports maxDuration as 30 (AC#17)", () => {
      expect(maxDuration).toBe(30);
    });
  });

  // ========================================================================
  // Authentication (AC#2)
  // ========================================================================

  describe("authentication (AC#2)", () => {
    it("returns 401 for unauthenticated requests", async () => {
      mocks.session = null;
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(401);
    });

    it("proceeds for authenticated requests", async () => {
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(200);
    });
  });

  // ========================================================================
  // Request validation (AC#1)
  // ========================================================================

  describe("request validation (AC#1)", () => {
    it("returns 400 for missing cardId", async () => {
      const response = await POST(
        createRequest({ messages: [{ role: "user", content: "hi" }] })
      );
      expect(response.status).toBe(400);
    });

    it("returns 400 for empty cardId", async () => {
      const response = await POST(createRequest({ messages: [], cardId: "" }));
      expect(response.status).toBe(400);
    });

    it("accepts valid request with optional purchaseContext", async () => {
      const response = await POST(
        createRequest({ ...validBody, purchaseContext: "electronics" })
      );
      expect(response.status).toBe(200);
    });
  });

  // ========================================================================
  // Authorization (AC#3)
  // ========================================================================

  describe("authorization (AC#3)", () => {
    it("returns 403 when card not found", async () => {
      mocks.cardResult = [];
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(403);
    });
  });

  // ========================================================================
  // Skeleton interaction write (AC#9)
  // ========================================================================

  describe("skeleton interaction write (AC#9)", () => {
    it("writes skeleton interaction before streaming", async () => {
      await POST(createRequest(validBody));
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it("returns 500 when skeleton write fails", async () => {
      mocks.insertError = new Error("DB write failed");
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(500);
    });
  });

  // ========================================================================
  // Streaming response (AC#5, #10)
  // ========================================================================

  describe("streaming response (AC#5, #10)", () => {
    it("returns streaming response with correct status", async () => {
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(200);
    });

    it("includes x-interaction-id header (AC#10)", async () => {
      const response = await POST(createRequest(validBody));
      const interactionId = response.headers.get("x-interaction-id");
      expect(interactionId).toBeTruthy();
      expect(interactionId).toMatch(UUID_REGEX);
    });
  });

  // ========================================================================
  // Error degradation (AC#14)
  // ========================================================================

  describe("error degradation (AC#14)", () => {
    it("returns 500 when DB card query fails", async () => {
      mocks.mockSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn(() => Promise.reject(new Error("DB error"))),
      });
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(500);
    });
  });

  // ========================================================================
  // after() callback (AC#9, #15)
  // ========================================================================

  describe("after() callback (Task 4)", () => {
    it("registers after() callback for interaction completion", async () => {
      await POST(createRequest(validBody));
      expect(mocks.mockAfter).toHaveBeenCalledWith(expect.any(Function));
    });

    it("after() callback updates interaction status to completed", async () => {
      await POST(createRequest(validBody));

      // Execute the after() callback
      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it("after() callback handles DB update errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      mocks.mockUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnThis(),
        where: vi.fn(() => Promise.reject(new Error("DB update failed"))),
      });

      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await expect(callback()).resolves.toBeUndefined();
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Guardian] Failed to update interaction"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("after() skips status update when stream generation fails", async () => {
      const rejected = Promise.reject(new Error("Stream generation failed"));
      // biome-ignore lint/suspicious/noEmptyBlockStatements: noop to prevent unhandled rejection warning
      rejected.catch(() => {});
      mocks.streamResult.text = rejected;
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      expect(mocks.mockUpdate).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Stream failed for interaction")
      );

      consoleSpy.mockRestore();
    });
  });

  // ========================================================================
  // Degradation ladder (Story 3.6)
  // ========================================================================

  describe("degradation ladder (Story 3.6)", () => {
    it("analyst-only fallback: returns auto-approve headers when streamText throws and tier is analyst", async () => {
      // Default mock returns score 10 → analyst tier
      mocks.streamTextError = new Error("Model initialization failed");
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-guardian-auto-approved")).toBe("true");
      expect(response.headers.get("x-guardian-degraded")).toBe("true");
      expect(response.headers.get("x-guardian-tier")).toBe("analyst");
      expect(await response.text()).toBe("Looks good! Card unlocked.");
    });

    it("break glass fallback: returns x-guardian-break-glass header when streamText throws and tier is negotiator", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      mocks.streamTextError = new Error("Model initialization failed");
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-guardian-break-glass")).toBe("true");
      expect(response.headers.get("x-guardian-tier")).toBe("negotiator");
      expect(response.headers.get("x-guardian-auto-approved")).toBeNull();
    });

    it("break glass fallback: returns x-guardian-break-glass header when tier is therapist", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 80,
        factors: [],
        reasoning: "test-therapist",
        historyAvailable: true,
      });
      mocks.streamTextError = new Error("Model initialization failed");
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-guardian-break-glass")).toBe("true");
      expect(response.headers.get("x-guardian-tier")).toBe("therapist");
    });

    it("analyst-only fallback: after() callback sets outcome to auto_approved", async () => {
      mocks.streamTextError = new Error("Model initialization failed");
      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      expect(updateReturn?.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          outcome: "auto_approved",
        })
      );
    });

    it("break glass fallback: after() callback sets outcome to break_glass", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      mocks.streamTextError = new Error("Model initialization failed");
      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      expect(updateReturn?.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          outcome: "break_glass",
        })
      );
    });

    it("degradation after() callback handles DB errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      mocks.mockUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnThis(),
        where: vi.fn(() => Promise.reject(new Error("DB update failed"))),
      });

      mocks.streamTextError = new Error("Model initialization failed");
      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await expect(callback()).resolves.toBeUndefined();
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[Guardian] Failed to update degraded interaction"
        ),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("next request after degradation attempts Full Guardian again (no sticky state)", async () => {
      // First request: streamText throws → degradation
      mocks.streamTextError = new Error("Model initialization failed");
      const degradedResponse = await POST(createRequest(validBody));
      expect(degradedResponse.headers.get("x-guardian-auto-approved")).toBe(
        "true"
      );
      expect(degradedResponse.headers.get("x-guardian-degraded")).toBe("true");

      // Second request: streamText succeeds → normal flow
      mocks.streamTextError = null;
      const normalResponse = await POST(createRequest(validBody));
      expect(normalResponse.status).toBe(200);
      expect(normalResponse.headers.get("x-guardian-degraded")).toBeNull();
    });

    it("analyst-only fallback includes x-guardian-degraded: true header", async () => {
      mocks.streamTextError = new Error("Model initialization failed");
      const response = await POST(createRequest(validBody));
      expect(response.headers.get("x-guardian-degraded")).toBe("true");
    });

    it("logs degradation event with failure reason", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      mocks.streamTextError = new Error("Model initialization failed");
      await POST(createRequest(validBody));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Guardian] Degradation activated")
        // No second arg — it's a single formatted string
      );

      consoleSpy.mockRestore();
    });

    it("calls logDegradationTrace with analyst_only for analyst degradation", async () => {
      const { logDegradationTrace } = await import("@/lib/server/opik");
      mocks.streamTextError = new Error("Model initialization failed");
      await POST(createRequest(validBody));
      expect(logDegradationTrace).toHaveBeenCalledWith(
        expect.any(String),
        "analyst_only",
        "Model initialization failed",
        expect.objectContaining({ score: 10, reasoning: "test" }),
        "analyst"
      );
    });

    it("calls logDegradationTrace with break_glass for non-analyst degradation", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      const { logDegradationTrace } = await import("@/lib/server/opik");
      mocks.streamTextError = new Error("Model initialization failed");
      await POST(createRequest(validBody));
      expect(logDegradationTrace).toHaveBeenCalledWith(
        expect.any(String),
        "break_glass",
        "Model initialization failed",
        expect.objectContaining({ score: 50, reasoning: "test-negotiator" }),
        "negotiator"
      );
    });
  });

  // ========================================================================
  // Skillbook context injection (Story 3.4)
  // ========================================================================

  describe("skillbook context injection (Story 3.4)", () => {
    it("proceeds with empty skillbook context", async () => {
      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(200);
    });

    it("calls loadUserSkillbook with session.user.id", async () => {
      const { loadUserSkillbook } = await import("@/lib/server/ace");
      await POST(createRequest(validBody));
      expect(loadUserSkillbook).toHaveBeenCalledWith("user-1");
    });

    it("injects skillbook context into system prompt when non-empty", async () => {
      const { loadUserSkillbook } = await import("@/lib/server/ace");
      vi.mocked(loadUserSkillbook).mockResolvedValueOnce(
        "[learned strategies]"
      );

      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining("[learned strategies]"),
        })
      );
    });

    it("uses tier prompt only when skillbook context is empty", async () => {
      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "You are a test analyst prompt.",
        })
      );
    });

    it("continues streaming when loadUserSkillbook throws (graceful degradation)", async () => {
      const { loadUserSkillbook } = await import("@/lib/server/ace");
      vi.mocked(loadUserSkillbook).mockRejectedValueOnce(
        new Error("ACE service down")
      );

      const response = await POST(createRequest(validBody));
      expect(response.status).toBe(200);
    });
  });

  // ========================================================================
  // Risk assessment integration (Story 3.2)
  // ========================================================================

  describe("risk assessment integration (Story 3.2)", () => {
    it("includes riskScore in skeleton interaction write", async () => {
      await POST(createRequest(validBody));
      // The insert mock should have been called with riskScore from assessRisk mock (score: 10)
      const insertCall = mocks.mockInsert.mock.results[0];
      expect(insertCall).toBeDefined();
      // Verify insert was called (values chain)
      const insertReturn = mocks.mockInsert.mock.results[0]?.value;
      expect(insertReturn?.values).toHaveBeenCalledWith(
        expect.objectContaining({ riskScore: 10 })
      );
    });

    it("calls assessRisk before skeleton write", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      await POST(createRequest(validBody));
      expect(assessRisk).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          cardId: "card-123",
        })
      );
    });

    it("passes risk metadata and tier to telemetry (AC#9)", async () => {
      const { getGuardianTelemetry } = await import("@/lib/server/opik");
      await POST(createRequest(validBody));
      expect(getGuardianTelemetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ score: 10, reasoning: "test" }),
        "analyst",
        true
      );
    });
  });

  // ========================================================================
  // Tier routing (Story 3.3)
  // ========================================================================

  describe("tier routing (Story 3.3)", () => {
    it("writes analyst tier to skeleton for score 10", async () => {
      await POST(createRequest(validBody));
      const insertReturn = mocks.mockInsert.mock.results[0]?.value;
      expect(insertReturn?.values).toHaveBeenCalledWith(
        expect.objectContaining({ tier: "analyst" })
      );
    });

    it("writes negotiator tier to skeleton for score 50", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      await POST(createRequest(validBody));
      const insertReturn = mocks.mockInsert.mock.results[0]?.value;
      expect(insertReturn?.values).toHaveBeenCalledWith(
        expect.objectContaining({ tier: "negotiator" })
      );
    });

    it("writes therapist tier to skeleton for score 80", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 80,
        factors: [],
        reasoning: "test-therapist",
        historyAvailable: true,
      });
      await POST(createRequest(validBody));
      const insertReturn = mocks.mockInsert.mock.results[0]?.value;
      expect(insertReturn?.values).toHaveBeenCalledWith(
        expect.objectContaining({ tier: "therapist" })
      );
    });

    it("passes prepareStep callback to streamText", async () => {
      const { streamText } = await import("ai");
      await POST(createRequest(validBody));
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          prepareStep: expect.any(Function),
        })
      );
    });

    it("passes stopWhen to streamText", async () => {
      const { streamText, stepCountIs } = await import("ai");
      // Default mock assessRisk returns score 10 (analyst), so stepCountIs(1)
      await POST(createRequest(validBody));
      expect(stepCountIs).toHaveBeenCalledWith(1);
      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          stopWhen: expect.anything(),
        })
      );
    });

    it("passes tier to telemetry for negotiator (score 50)", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      const { getGuardianTelemetry } = await import("@/lib/server/opik");
      await POST(createRequest(validBody));
      expect(getGuardianTelemetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ score: 50, reasoning: "test-negotiator" }),
        "negotiator",
        false
      );
    });
  });

  // ========================================================================
  // Auto-approve flow (Story 3.5)
  // ========================================================================

  describe("auto-approve flow (Story 3.5)", () => {
    it("includes x-guardian-auto-approved header for analyst tier (score < 30)", async () => {
      const response = await POST(createRequest(validBody));
      expect(response.headers.get("x-guardian-auto-approved")).toBe("true");
    });

    it("includes x-guardian-tier header set to analyst", async () => {
      const response = await POST(createRequest(validBody));
      expect(response.headers.get("x-guardian-tier")).toBe("analyst");
    });

    it("uses stepCountIs(1) for analyst tier", async () => {
      const { stepCountIs } = await import("ai");
      await POST(createRequest(validBody));
      expect(stepCountIs).toHaveBeenCalledWith(1);
    });

    it("does NOT include x-guardian-auto-approved header for negotiator tier (score >= 30)", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      const response = await POST(createRequest(validBody));
      expect(response.headers.get("x-guardian-auto-approved")).toBeNull();
    });

    it("uses stepCountIs(5) for non-analyst tiers", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      const { stepCountIs } = await import("ai");
      await POST(createRequest(validBody));
      expect(stepCountIs).toHaveBeenCalledWith(5);
    });

    it("sets x-guardian-tier header to negotiator for score 50", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      const response = await POST(createRequest(validBody));
      expect(response.headers.get("x-guardian-tier")).toBe("negotiator");
    });

    it("boundary: score 29 auto-approves (analyst tier)", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 29,
        factors: [],
        reasoning: "test-boundary-29",
        historyAvailable: true,
      });
      const response = await POST(createRequest(validBody));
      expect(response.headers.get("x-guardian-auto-approved")).toBe("true");
      expect(response.headers.get("x-guardian-tier")).toBe("analyst");
    });

    it("boundary: score 30 does NOT auto-approve (negotiator tier)", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 30,
        factors: [],
        reasoning: "test-boundary-30",
        historyAvailable: true,
      });
      const response = await POST(createRequest(validBody));
      expect(response.headers.get("x-guardian-auto-approved")).toBeNull();
      expect(response.headers.get("x-guardian-tier")).toBe("negotiator");
    });

    it("after() callback sets outcome to auto_approved for analyst tier", async () => {
      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      expect(updateReturn?.set).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: "auto_approved" })
      );
    });

    it("after() callback does NOT set outcome for non-analyst tiers", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });

      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      const setCall = updateReturn?.set.mock.calls[0]?.[0];
      expect(setCall.status).toBe("completed");
      expect(setCall.reasoningSummary).toBe("mock response text");
      expect(setCall.outcome).toBeUndefined();
    });

    it("passes autoApproved to telemetry for analyst tier", async () => {
      const { getGuardianTelemetry } = await import("@/lib/server/opik");
      await POST(createRequest(validBody));
      expect(getGuardianTelemetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ score: 10, reasoning: "test" }),
        "analyst",
        true
      );
    });

    it("passes autoApproved=false to telemetry for non-analyst tiers", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 70,
        factors: [],
        reasoning: "test-therapist",
        historyAvailable: true,
      });
      const { getGuardianTelemetry } = await import("@/lib/server/opik");
      await POST(createRequest(validBody));
      expect(getGuardianTelemetry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ score: 70, reasoning: "test-therapist" }),
        "therapist",
        false
      );
    });
  });

  // ========================================================================
  // Two-Phase Interaction Persistence (Story 3.7)
  // ========================================================================

  describe("two-phase interaction persistence (Story 3.7)", () => {
    // Task 6.1: skeleton write includes all required fields with outcome: null
    it("skeleton write includes outcome: null explicitly", async () => {
      await POST(createRequest(validBody));
      const insertReturn = mocks.mockInsert.mock.results[0]?.value;
      expect(insertReturn?.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          cardId: "card-123",
          tier: "analyst",
          riskScore: 10,
          status: "pending",
          outcome: null,
        })
      );
    });

    it("skeleton write includes id field as UUID", async () => {
      await POST(createRequest(validBody));
      const insertReturn = mocks.mockInsert.mock.results[0]?.value;
      expect(insertReturn?.values).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(UUID_REGEX),
        })
      );
    });

    // Task 6.2: after() updates with status "completed" and reasoningSummary
    it("after() callback includes reasoningSummary when stream succeeds (non-auto-approve)", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });

      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      expect(updateReturn?.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          reasoningSummary: "mock response text",
        })
      );
    });

    // Task 6.3: auto-approved after() includes reasoningSummary
    it("after() callback includes auto-approve reasoningSummary for analyst tier", async () => {
      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      expect(updateReturn?.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          outcome: "auto_approved",
          reasoningSummary:
            "Low-risk unlock request (score: 10). Auto-approved without intervention.",
        })
      );
    });

    // Task 6.2 continued: truncation at word boundary for long text
    it("after() truncates reasoningSummary at last space before 500 chars with ellipsis", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });

      // Create a long text that exceeds 500 chars
      const longText = `${"word ".repeat(100)}end`;
      mocks.streamResult.text = Promise.resolve(longText);

      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      const setCall = updateReturn?.set.mock.calls[0]?.[0];
      expect(setCall.reasoningSummary).toBeDefined();
      expect(setCall.reasoningSummary.length).toBeLessThanOrEqual(504); // 500 + "..."
      expect(setCall.reasoningSummary).toMatch(ELLIPSIS_SUFFIX_REGEX);
    });

    // Task 6.2 edge case: truncation with no spaces falls back to hard cut at 500
    it("after() hard-cuts reasoningSummary at 500 chars when text has no spaces", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });

      // Text with no spaces at all — lastIndexOf(" ", 500) returns -1
      const noSpaceText = "x".repeat(800);
      mocks.streamResult.text = Promise.resolve(noSpaceText);

      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      const setCall = updateReturn?.set.mock.calls[0]?.[0];
      expect(setCall.reasoningSummary).toBeDefined();
      expect(setCall.reasoningSummary.length).toBe(503); // 500 + "..."
      expect(setCall.reasoningSummary).toMatch(ELLIPSIS_SUFFIX_REGEX);
    });

    // Task 6.4 / Task 3.2: stream failure → covered by "after() skips status update
    // when stream generation fails" test in after() callback section above.

    // Task 3.3: skeleton record exists with null outcome when streaming never completes
    it("skeleton record is created even when streaming never completes", async () => {
      // Simulate a stream that never resolves
      // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally never-resolving promise
      const neverResolving = new Promise<string>(() => {});
      mocks.streamResult.text = neverResolving;

      await POST(createRequest(validBody));

      // The insert (skeleton write) should have been called
      expect(mocks.mockInsert).toHaveBeenCalled();
      const insertReturn = mocks.mockInsert.mock.results[0]?.value;
      expect(insertReturn?.values).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "pending",
          outcome: null,
        })
      );

      // The after() callback was registered but hasn't resolved yet
      expect(mocks.mockAfter).toHaveBeenCalledWith(expect.any(Function));
    });

    // Task 6.5: x-interaction-id on normal streaming response — covered by
    // "includes x-interaction-id header (AC#10)" test in streaming response section above.

    // Task 6.6: x-interaction-id on degraded analyst-only response
    it("x-interaction-id header is present on degraded analyst-only response", async () => {
      mocks.streamTextError = new Error("Model initialization failed");
      const response = await POST(createRequest(validBody));
      const interactionId = response.headers.get("x-interaction-id");
      expect(interactionId).toBeTruthy();
      expect(interactionId).toMatch(UUID_REGEX);
    });

    // Task 6.7: x-interaction-id on break-glass response
    it("x-interaction-id header is present on break-glass response", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      mocks.streamTextError = new Error("Model initialization failed");
      const response = await POST(createRequest(validBody));
      const interactionId = response.headers.get("x-interaction-id");
      expect(interactionId).toBeTruthy();
      expect(interactionId).toMatch(UUID_REGEX);
    });

    // Task 6.8: degradation after() includes reasoningSummary
    it("analyst-only degradation after() includes reasoningSummary describing the failure", async () => {
      mocks.streamTextError = new Error("Model initialization failed");
      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      expect(updateReturn?.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          outcome: "auto_approved",
          reasoningSummary:
            "System failure — analyst_only fallback activated. Reason: Model initialization failed",
        })
      );
    });

    it("break-glass degradation after() includes reasoningSummary describing the failure", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      mocks.streamTextError = new Error("Model initialization failed");
      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      expect(updateReturn?.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
          outcome: "break_glass",
          reasoningSummary:
            "System failure — break_glass fallback activated. Reason: Model initialization failed",
        })
      );
    });
  });

  // ========================================================================
  // purchaseContext validation (M3 — length limit)
  // ========================================================================

  describe("purchaseContext validation", () => {
    it("returns 400 for purchaseContext exceeding 500 characters", async () => {
      const longContext = "a".repeat(501);
      const response = await POST(
        createRequest({ ...validBody, purchaseContext: longContext })
      );
      expect(response.status).toBe(400);
    });

    it("accepts purchaseContext at exactly 500 characters", async () => {
      const maxContext = "a".repeat(500);
      const response = await POST(
        createRequest({ ...validBody, purchaseContext: maxContext })
      );
      expect(response.status).toBe(200);
    });
  });

  // ========================================================================
  // Coupon Search Tool (Story 4.1)
  // ========================================================================

  describe("coupon search tool (Story 4.1)", () => {
    // Test 6.5: prepareStep returns activeTools containing "search_coupons" for negotiator
    it("prepareStep returns activeTools with search_coupons when tier is negotiator", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });

      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      const call = vi.mocked(streamText).mock.calls[0]?.[0];
      const prepareStep = call?.prepareStep as
        | (() => Record<string, unknown>)
        | undefined;
      expect(prepareStep).toBeDefined();
      const stepResult = prepareStep?.();
      expect(stepResult).toEqual({
        toolCallStreaming: true,
        activeTools: ["search_coupons"],
      });
    });

    // Test 6.6: prepareStep returns empty object for analyst
    it("prepareStep returns empty object when tier is analyst", async () => {
      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      const call = vi.mocked(streamText).mock.calls[0]?.[0];
      const prepareStep = call?.prepareStep as
        | (() => Record<string, unknown>)
        | undefined;
      expect(prepareStep).toBeDefined();
      const stepResult = prepareStep?.();
      expect(stepResult).toEqual({});
    });

    // Test 6.7: prepareStep returns therapist tools for therapist tier (Story 5.1)
    it("prepareStep returns activeTools with present_reflection and show_wait_option when tier is therapist", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 80,
        factors: [],
        reasoning: "test-therapist",
        historyAvailable: true,
      });

      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      const call = vi.mocked(streamText).mock.calls[0]?.[0];
      const prepareStep = call?.prepareStep as
        | (() => Record<string, unknown>)
        | undefined;
      expect(prepareStep).toBeDefined();
      const stepResult = prepareStep?.();
      expect(stepResult).toEqual({
        toolCallStreaming: true,
        activeTools: ["present_reflection", "show_wait_option"],
      });
    });

    // Test: streamText receives tools parameter with search_coupons
    it("streamText receives tools parameter with search_coupons tool", async () => {
      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            search_coupons: expect.objectContaining({
              description: expect.any(String),
            }),
          }),
        })
      );
    });

    // Test 6.9: ToolName type includes "search_coupons" (compile-time check)
    it("TOOL_NAMES.SEARCH_COUPONS equals 'search_coupons'", async () => {
      const { TOOL_NAMES } = await import("@/lib/guardian/tool-names");
      expect(TOOL_NAMES.SEARCH_COUPONS).toBe("search_coupons");
    });

    // Test: negotiator tier uses stepCountIs(5) (not auto-approved)
    it("negotiator tier uses stepCountIs(5) allowing multi-step tool loop", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });
      const { stepCountIs } = await import("ai");
      await POST(createRequest(validBody));
      expect(stepCountIs).toHaveBeenCalledWith(5);
    });
  });

  // ========================================================================
  // Therapist Reflection Tools (Story 5.1)
  // ========================================================================

  describe("therapist reflection tools (Story 5.1)", () => {
    it("streamText receives tools parameter with present_reflection tool", async () => {
      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            present_reflection: expect.objectContaining({
              description: expect.any(String),
            }),
          }),
        })
      );
    });

    it("streamText receives tools parameter with show_wait_option tool", async () => {
      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: expect.objectContaining({
            show_wait_option: expect.objectContaining({
              description: expect.any(String),
            }),
          }),
        })
      );
    });

    it("therapist tools are NOT in activeTools when tier is negotiator", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 50,
        factors: [],
        reasoning: "test-negotiator",
        historyAvailable: true,
      });

      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      const call = vi.mocked(streamText).mock.calls[0]?.[0];
      const prepareStep = call?.prepareStep as
        | (() => Record<string, unknown>)
        | undefined;
      const stepResult = prepareStep?.() as {
        activeTools?: string[];
      };
      expect(stepResult.activeTools).toEqual(["search_coupons"]);
      expect(stepResult.activeTools).not.toContain("present_reflection");
      expect(stepResult.activeTools).not.toContain("show_wait_option");
    });

    it("therapist tier uses stepCountIs(5) (not auto-approved)", async () => {
      const { assessRisk } = await import("@/lib/server/guardian/risk");
      vi.mocked(assessRisk).mockResolvedValueOnce({
        score: 80,
        factors: [],
        reasoning: "test-therapist",
        historyAvailable: true,
      });
      const { stepCountIs } = await import("ai");
      await POST(createRequest(validBody));
      expect(stepCountIs).toHaveBeenCalledWith(5);
    });
  });

  // ========================================================================
  // Banned Terminology Guardrail (Story 5.4)
  // ========================================================================

  describe("banned terminology guardrail (Story 5.4)", () => {
    it("passes experimental_transform to streamText as a function (AC#3, #9)", async () => {
      const { streamText } = await import("ai");
      await POST(createRequest(validBody));

      expect(streamText).toHaveBeenCalledWith(
        expect.objectContaining({
          experimental_transform: expect.any(Function),
        })
      );
    });

    it("uses createBannedTermFilter as the experimental_transform value (AC#9)", async () => {
      await POST(createRequest(validBody));
      expect(mocks.mockCreateBannedTermFilter).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });

    it("after() includes banned_terms_replaced in metadata when replacements occur (AC#4)", async () => {
      // Override mock to invoke onReplacements callback (simulates filter catching a term)
      mocks.mockCreateBannedTermFilter.mockImplementationOnce(
        (
          onReplacements: (
            r: Array<{ original: string; replacement: string | null }>
          ) => void
        ) => {
          onReplacements([{ original: "addiction", replacement: "pattern" }]);
          return vi.fn(() => new TransformStream());
        }
      );

      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      expect(updateReturn?.set).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            banned_terms_replaced: [
              { original: "addiction", replacement: "pattern" },
            ],
          },
        })
      );
    });

    it("after() logs console.warn when banned terms are replaced (AC#4)", async () => {
      const consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      mocks.mockCreateBannedTermFilter.mockImplementationOnce(
        (
          onReplacements: (
            r: Array<{ original: string; replacement: string | null }>
          ) => void
        ) => {
          onReplacements([{ original: "therapy", replacement: "support" }]);
          return vi.fn(() => new TransformStream());
        }
      );

      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[Guardian] Banned term replaced in interaction"
        )
      );

      consoleSpy.mockRestore();
    });

    it("after() does NOT include metadata when no replacements occur", async () => {
      await POST(createRequest(validBody));

      const callback = mocks.mockAfter.mock.calls[0]?.[0];
      if (typeof callback === "function") {
        await callback();
      }

      const updateReturn = mocks.mockUpdate.mock.results[0]?.value;
      const setCall = updateReturn?.set.mock.calls[0]?.[0];
      expect(setCall.metadata).toBeUndefined();
    });
  });
});
