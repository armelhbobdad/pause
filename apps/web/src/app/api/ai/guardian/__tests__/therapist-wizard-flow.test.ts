import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockAfter = vi.fn();
  const mockAssessRisk = vi.fn();

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
    mockAssessRisk,
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

// --- Mock @pause/env/server ---
vi.mock("@pause/env/server", () => ({
  env: { DEMO_MODE: "false" },
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

// --- Mock model factory ---
vi.mock("@/lib/server/model", () => ({
  getModel: vi.fn(() => "mock-model"),
}));

// --- Mock tool-names (all four tools) ---
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

// --- Mock wizard option tool ---
vi.mock("@/lib/server/guardian/tools/wizard-option", () => ({
  presentWizardOptionTool: {
    description: "Offer deeper reflection wizard",
    inputSchema: {},
    execute: vi.fn(),
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

// --- Mock risk (configurable per-test) ---
vi.mock("@/lib/server/guardian/risk", () => ({
  assessRisk: mocks.mockAssessRisk,
}));

// --- Mock ACE adapter ---
vi.mock("@/lib/server/ace", () => ({
  loadUserSkillbook: vi.fn().mockResolvedValue(""),
}));

// --- Mock telemetry ---
vi.mock("@/lib/server/opik", () => ({
  getGuardianTelemetry: vi.fn(() => ({
    isEnabled: true,
    functionId: "guardian",
  })),
  logDegradationTrace: vi.fn(),
}));

// --- Mock prompt modules ---
vi.mock("@/lib/server/guardian/prompts/analyst", () => ({
  ANALYST_SYSTEM_PROMPT: "You are a test analyst prompt.",
}));

vi.mock("@/lib/server/guardian/prompts/negotiator", () => ({
  NEGOTIATOR_SYSTEM_PROMPT: "You are a test negotiator prompt.",
}));

vi.mock("@/lib/server/guardian/prompts/therapist", () => ({
  THERAPIST_SYSTEM_PROMPT:
    "You are the Therapist (Reflective Guide). Use present_reflection, show_wait_option, and present_wizard_option tools.",
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
// Therapist Wizard Flow Integration Tests (Story 5.5 AC#17)
// ============================================================================

describe("Therapist wizard flow integration (Story 5.5)", () => {
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

  it("risk >= 85 includes present_wizard_option in active tools", async () => {
    mocks.mockAssessRisk.mockResolvedValue({
      score: 85,
      factors: [],
      reasoning: "very-high-risk",
      historyAvailable: true,
    });

    const { streamText } = await import("ai");

    await POST(createRequest(validBody));

    const call = vi.mocked(streamText).mock.calls[0]?.[0];
    expect(call).toBeDefined();

    // Verify wizard tool is registered
    expect(call?.tools).toHaveProperty("present_wizard_option");

    // Verify prepareStep includes wizard tool
    const prepareStep = call?.prepareStep as
      | (() => Record<string, unknown>)
      | undefined;
    expect(prepareStep).toBeDefined();
    const stepResult = prepareStep?.() as { activeTools?: string[] };
    expect(stepResult.activeTools).toContain("present_wizard_option");
    expect(stepResult.activeTools).toContain("present_reflection");
    expect(stepResult.activeTools).toContain("show_wait_option");
  });

  it("risk 70-84 does NOT include present_wizard_option in active tools", async () => {
    mocks.mockAssessRisk.mockResolvedValue({
      score: 80,
      factors: [],
      reasoning: "high-risk-not-very-high",
      historyAvailable: true,
    });

    const { streamText } = await import("ai");

    await POST(createRequest(validBody));

    const call = vi.mocked(streamText).mock.calls[0]?.[0];
    expect(call).toBeDefined();

    // Verify prepareStep does NOT include wizard tool
    const prepareStep = call?.prepareStep as
      | (() => Record<string, unknown>)
      | undefined;
    expect(prepareStep).toBeDefined();
    const stepResult = prepareStep?.() as { activeTools?: string[] };
    expect(stepResult.activeTools).not.toContain("present_wizard_option");
    expect(stepResult.activeTools).toContain("present_reflection");
    expect(stepResult.activeTools).toContain("show_wait_option");
  });

  it("risk score of exactly 84 does NOT include wizard tool", async () => {
    mocks.mockAssessRisk.mockResolvedValue({
      score: 84,
      factors: [],
      reasoning: "boundary-test",
      historyAvailable: true,
    });

    const { streamText } = await import("ai");

    await POST(createRequest(validBody));

    const call = vi.mocked(streamText).mock.calls[0]?.[0];
    const prepareStep = call?.prepareStep as
      | (() => Record<string, unknown>)
      | undefined;
    const stepResult = prepareStep?.() as { activeTools?: string[] };
    expect(stepResult.activeTools).not.toContain("present_wizard_option");
  });

  it("risk score of 100 includes wizard tool", async () => {
    mocks.mockAssessRisk.mockResolvedValue({
      score: 100,
      factors: [],
      reasoning: "max-risk",
      historyAvailable: true,
    });

    const { streamText } = await import("ai");

    await POST(createRequest(validBody));

    const call = vi.mocked(streamText).mock.calls[0]?.[0];
    const prepareStep = call?.prepareStep as
      | (() => Record<string, unknown>)
      | undefined;
    const stepResult = prepareStep?.() as { activeTools?: string[] };
    expect(stepResult.activeTools).toContain("present_wizard_option");
  });
});
