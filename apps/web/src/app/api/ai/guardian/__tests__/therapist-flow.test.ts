import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockAfter = vi.fn();

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
  };
});

// --- Mock server-only ---
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

// --- Mock Google provider ---
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-gemini-model"),
}));

// --- Mock tool-names (shared type) ---
vi.mock("@/lib/guardian/tool-names", () => ({
  TOOL_NAMES: {
    SEARCH_COUPONS: "search_coupons",
    PRESENT_REFLECTION: "present_reflection",
    SHOW_WAIT_OPTION: "show_wait_option",
    PRESENT_WIZARD_OPTION: "present_wizard_option",
  },
}));

// --- Mock coupon search tool ---
vi.mock("@/lib/server/guardian/tools/coupon-search", () => ({
  searchCouponsTool: {
    description: "Search for coupons",
    inputSchema: {},
    execute: vi.fn(),
  },
}));

// --- Mock reflection tool (with real pass-through logic) ---
vi.mock("@/lib/server/guardian/tools/reflection-prompt", () => ({
  presentReflectionTool: {
    description: "Present a reflective question",
    inputSchema: {},
    execute: vi.fn(
      (input: {
        strategyId: string;
        reflectionPrompt: string;
        strategyName: string;
      }) => ({
        strategyId: input.strategyId,
        reflectionPrompt: input.reflectionPrompt,
        strategyName: input.strategyName,
      })
    ),
  },
}));

// --- Mock wait option tool (with real pass-through logic) ---
vi.mock("@/lib/server/guardian/tools/wait-option", () => ({
  showWaitOptionTool: {
    description: "Offer a wait period",
    inputSchema: {},
    execute: vi.fn((input: { reasoning: string }) => ({
      durationHours: 24,
      reasoning: input.reasoning,
    })),
  },
}));

// --- Mock wizard option tool (with real pass-through logic) ---
vi.mock("@/lib/server/guardian/tools/wizard-option", () => ({
  presentWizardOptionTool: {
    description: "Offer deeper reflection wizard",
    inputSchema: {},
    execute: vi.fn((input: { reasoning: string }) => ({
      wizardAvailable: true,
      reasoning: input.reasoning,
    })),
  },
}));

// --- Mock coupon provider ---
vi.mock("@/lib/server/guardian/tools/coupon-provider", () => ({
  searchCoupons: vi.fn(),
}));

// --- Mock server-side utilities ---
vi.mock("@/lib/server/utils", () => ({
  withTimeout: vi.fn(<T>(promise: Promise<T>, _ms: number) => promise),
}));

// --- Mock risk (high score for therapist tier) ---
vi.mock("@/lib/server/guardian/risk", () => ({
  assessRisk: vi.fn().mockResolvedValue({
    score: 80,
    factors: [],
    reasoning: "test-therapist-flow",
    historyAvailable: true,
  }),
}));

// --- Mock ACE adapter ---
vi.mock("@/lib/server/ace", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/ace")>();
  return {
    ...actual,
    loadUserSkillbook: vi.fn().mockResolvedValue(""),
    loadUserSkillbookInstance: vi.fn().mockResolvedValue({
      skillbook: actual.Skillbook
        ? new actual.Skillbook()
        : { skills: () => [] },
      version: 0,
    }),
    wrapSkillbookContext: vi.fn(() => ""),
  };
});

// --- Mock telemetry ---
vi.mock("@/lib/server/opik", () => ({
  getGuardianTelemetry: vi.fn(() => ({
    isEnabled: true,
    functionId: "guardian",
  })),
  logDegradationTrace: vi.fn(),
}));

// --- Mock prompt modules (analyst/negotiator are simple strings) ---
vi.mock("@/lib/server/guardian/prompts/analyst", () => ({
  ANALYST_SYSTEM_PROMPT: "You are a test analyst prompt.",
}));

vi.mock("@/lib/server/guardian/prompts/negotiator", () => ({
  NEGOTIATOR_SYSTEM_PROMPT: "You are a test negotiator prompt.",
}));

// --- Therapist prompt: use a recognizable string for route-level tests ---
vi.mock("@/lib/server/guardian/prompts/therapist", () => ({
  THERAPIST_SYSTEM_PROMPT:
    "You are the Therapist (Reflective Guide). Use present_reflection and show_wait_option tools.",
}));

// --- Mock tiers (real logic) ---
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

// --- Import the route handler AFTER mocks ---
import { POST } from "../route";

// ============================================================================
// Helpers
// ============================================================================

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/ai/guardian", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  cardId: "card-123",
  messages: [{ role: "user", content: "I want to buy this", id: "msg-1" }],
};

// ============================================================================
// Therapist Flow Integration Tests (Story 5.2)
// ============================================================================

describe("Therapist flow integration (Story 5.2)", () => {
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

  // --- Subtask 1.1: End-to-end therapist tier flow ---
  describe("end-to-end therapist tier flow", () => {
    it("high-risk score routes to therapist tier with both reflection tools active", async () => {
      const { streamText } = await import("ai");

      await POST(createRequest(validBody));

      const call = vi.mocked(streamText).mock.calls[0]?.[0];
      expect(call).toBeDefined();

      // Verify therapist tools are registered
      expect(call?.tools).toHaveProperty("present_reflection");
      expect(call?.tools).toHaveProperty("show_wait_option");

      // Verify prepareStep activates therapist tools
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

    it("present_reflection tool execute returns pass-through output", async () => {
      const { presentReflectionTool } = await vi.importActual<{
        presentReflectionTool: {
          execute?: (
            input: Record<string, unknown>,
            context: Record<string, unknown>
          ) => unknown;
        };
      }>("@/lib/server/guardian/tools/reflection-prompt");

      const input = {
        strategyId: "future_self",
        reflectionPrompt: "What would tomorrow-you think about this one?",
        strategyName: "Future-Self Visualization",
      };

      expect(presentReflectionTool.execute).toBeDefined();
      const result = presentReflectionTool.execute?.(input, {
        toolCallId: "test-call-1",
        messages: [],
      });

      expect(result).toEqual({
        strategyId: "future_self",
        reflectionPrompt: "What would tomorrow-you think about this one?",
        strategyName: "Future-Self Visualization",
      });
    });

    it("show_wait_option tool execute returns hardcoded durationHours: 24", async () => {
      const { showWaitOptionTool } = await vi.importActual<{
        showWaitOptionTool: {
          execute?: (
            input: Record<string, unknown>,
            context: Record<string, unknown>
          ) => unknown;
        };
      }>("@/lib/server/guardian/tools/wait-option");

      expect(showWaitOptionTool.execute).toBeDefined();
      const result = showWaitOptionTool.execute?.(
        { reasoning: "Sleeping on it often brings clarity" },
        { toolCallId: "test-call-2", messages: [] }
      );

      expect(result).toEqual({
        durationHours: 24,
        reasoning: "Sleeping on it often brings clarity",
      });
    });

    it("therapist system prompt is used when tier is therapist (score >= 70)", async () => {
      const { streamText } = await import("ai");

      await POST(createRequest(validBody));

      const call = vi.mocked(streamText).mock.calls[0]?.[0];
      const systemPrompt = call?.system as string;

      // Verify therapist prompt is selected
      expect(systemPrompt).toContain("Therapist");
      expect(systemPrompt).toContain("Reflective Guide");
    });
  });

  // --- Subtask 1.2: prepareStep for therapist tier ---
  describe("prepareStep therapist tier configuration", () => {
    it("returns toolCallStreaming: true for therapist tier", async () => {
      const { streamText } = await import("ai");

      await POST(createRequest(validBody));

      const call = vi.mocked(streamText).mock.calls[0]?.[0];
      const prepareStep = call?.prepareStep as
        | (() => Record<string, unknown>)
        | undefined;
      const stepResult = prepareStep?.() as {
        toolCallStreaming?: boolean;
        activeTools?: string[];
      };
      expect(stepResult.toolCallStreaming).toBe(true);
    });

    it("activeTools contains exactly PRESENT_REFLECTION and SHOW_WAIT_OPTION", async () => {
      const { streamText } = await import("ai");

      await POST(createRequest(validBody));

      const call = vi.mocked(streamText).mock.calls[0]?.[0];
      const prepareStep = call?.prepareStep as
        | (() => Record<string, unknown>)
        | undefined;
      const stepResult = prepareStep?.() as {
        activeTools?: string[];
      };
      expect(stepResult.activeTools).toEqual([
        "present_reflection",
        "show_wait_option",
      ]);
    });
  });

  // --- Subtask 1.3: THERAPIST_SYSTEM_PROMPT content verification ---
  describe("THERAPIST_SYSTEM_PROMPT includes required instructions", () => {
    it("includes strategy selection instructions with Skillbook scanning", async () => {
      // Import the REAL module, bypassing the mock
      const mod = await vi.importActual<{
        THERAPIST_SYSTEM_PROMPT: string;
      }>("@/lib/server/guardian/prompts/therapist");

      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain(
        "Reflection Strategy Selection"
      );
      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain("Scan Skillbook");
    });

    it("includes tool usage documentation for all three tools", async () => {
      const mod = await vi.importActual<{
        THERAPIST_SYSTEM_PROMPT: string;
      }>("@/lib/server/guardian/prompts/therapist");

      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain("present_reflection");
      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain("show_wait_option");
      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain("present_wizard_option");
      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain(
        "Call this second, after presenting the reflection"
      );
    });

    it("includes all four default strategy types", async () => {
      const mod = await vi.importActual<{
        THERAPIST_SYSTEM_PROMPT: string;
      }>("@/lib/server/guardian/prompts/therapist");

      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain("future_self");
      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain("cost_reframe");
      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain("cooling_off");
      expect(mod.THERAPIST_SYSTEM_PROMPT).toContain("values_alignment");
    });
  });
});
