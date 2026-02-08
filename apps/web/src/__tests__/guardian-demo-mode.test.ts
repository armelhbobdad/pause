import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockAfter = vi.fn();
  const mockStreamText = vi.fn();

  return {
    session: null as { user: { id: string } } | null,
    cardResult: [] as Array<{ id: string; userId: string }>,
    demoMode: "false" as string,
    streamResult: {
      toUIMessageStreamResponse: () =>
        new Response("stream-body", {
          status: 200,
          headers: { "content-type": "text/event-stream" },
        }),
      text: Promise.resolve("mock response text") as Promise<string>,
    },
    mockSelect,
    mockInsert,
    mockUpdate,
    mockAfter,
    mockStreamText,
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
  env: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "DEMO_MODE") {
          return mocks.demoMode;
        }
        return undefined;
      },
    }
  ),
}));

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve(mocks.cardResult)),
  };
  const insertChain = {
    values: vi.fn(() => Promise.resolve()),
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
  streamText: (...args: unknown[]) => {
    mocks.mockStreamText(...args);
    return mocks.streamResult;
  },
  stepCountIs: vi.fn((n: number) => ({ type: "stepCount", count: n })),
  tool: vi.fn((def: unknown) => def),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-gemini-model"),
}));

// --- Mock tool-names ---
vi.mock("@/lib/guardian/tool-names", () => ({
  TOOL_NAMES: {
    SEARCH_COUPONS: "search_coupons",
    PRESENT_REFLECTION: "present_reflection",
    SHOW_WAIT_OPTION: "show_wait_option",
    PRESENT_WIZARD_OPTION: "present_wizard_option",
  },
}));

// --- Mock tools ---
vi.mock("@/lib/server/guardian/tools/coupon-search", () => ({
  searchCouponsTool: { description: "mock coupon search", inputSchema: {} },
}));
vi.mock("@/lib/server/guardian/tools/reflection-prompt", () => ({
  presentReflectionTool: { description: "mock reflection", inputSchema: {} },
}));
vi.mock("@/lib/server/guardian/tools/wait-option", () => ({
  showWaitOptionTool: { description: "mock wait", inputSchema: {} },
}));
vi.mock("@/lib/server/guardian/tools/wizard-option", () => ({
  presentWizardOptionTool: { description: "mock wizard", inputSchema: {} },
}));

// --- Mock filters ---
vi.mock("@/lib/server/guardian/filters", () => ({
  createBannedTermFilter: vi.fn(() => vi.fn(() => new TransformStream())),
}));

// --- Mock server utilities ---
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
  loadUserSkillbookInstance: vi.fn(async () => ({
    skillbook: { skills: () => [] },
    version: 0,
  })),
  wrapSkillbookContext: vi.fn(() => ""),
}));

vi.mock("@/lib/server/opik", () => ({
  getGuardianTelemetry: vi.fn(),
  logDegradationTrace: vi.fn(),
  buildReasoningSummary: vi.fn(() => "summary"),
  writeTraceMetadata: vi.fn(),
}));

vi.mock("@/lib/server/guardian/prompts/analyst", () => ({
  ANALYST_SYSTEM_PROMPT: "analyst prompt",
}));
vi.mock("@/lib/server/guardian/prompts/negotiator", () => ({
  NEGOTIATOR_SYSTEM_PROMPT: "negotiator prompt",
}));
vi.mock("@/lib/server/guardian/prompts/therapist", () => ({
  THERAPIST_SYSTEM_PROMPT: "therapist prompt",
}));

vi.mock("@/lib/server/guardian/tiers", () => ({
  determineTier: vi.fn((score: number) => {
    if (score >= 70) {
      return "therapist";
    }
    if (score >= 30) {
      return "negotiator";
    }
    return "analyst";
  }),
}));

vi.mock("@/lib/server/strategy-prediction", () => ({
  predictNextStrategy: vi.fn(() => ({
    strategy_id: "auto_approve",
    confidence: 1,
    alternatives: [],
  })),
}));

// --- Import route handler ---
import { POST } from "../app/api/ai/guardian/route";

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/ai/guardian", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  messages: [{ role: "user", content: "test", id: "msg-1" }],
  cardId: "card-123",
};

describe("Guardian Demo Mode (Story 9.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1" } };
    mocks.cardResult = [{ id: "card-123", userId: "user-1" }];
    mocks.demoMode = "false";
    mocks.streamResult.text = Promise.resolve("mock response text");

    // Re-setup mock chains after clearAllMocks
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(() => Promise.resolve(mocks.cardResult)),
    };
    const insertChain = {
      values: vi.fn(() => Promise.resolve()),
    };
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn(() => Promise.resolve()),
    };

    mocks.mockSelect.mockReturnValue(selectChain);
    mocks.mockInsert.mockReturnValue(insertChain);
    mocks.mockUpdate.mockReturnValue(updateChain);
  });

  it("passes temperature:0 to streamText when DEMO_MODE is 'true'", async () => {
    mocks.demoMode = "true";
    await POST(createRequest(validBody));

    expect(mocks.mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0 })
    );
  });

  it("passes seed:42 to streamText when DEMO_MODE is 'true'", async () => {
    mocks.demoMode = "true";
    await POST(createRequest(validBody));

    expect(mocks.mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({ seed: 42 })
    );
  });

  it("does not pass temperature to streamText when DEMO_MODE is 'false'", async () => {
    mocks.demoMode = "false";
    await POST(createRequest(validBody));

    const callArgs = mocks.mockStreamText.mock.calls[0]?.[0];
    expect(callArgs.temperature).toBeUndefined();
  });

  it("does not pass seed to streamText when DEMO_MODE is 'false'", async () => {
    mocks.demoMode = "false";
    await POST(createRequest(validBody));

    const callArgs = mocks.mockStreamText.mock.calls[0]?.[0];
    expect(callArgs.seed).toBeUndefined();
  });

  it("still returns a valid streaming response when DEMO_MODE is 'true'", async () => {
    mocks.demoMode = "true";
    const response = await POST(createRequest(validBody));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-interaction-id")).toBeTruthy();
  });

  it("passes both temperature:0 and seed:42 together in the same call", async () => {
    mocks.demoMode = "true";
    await POST(createRequest(validBody));

    const callArgs = mocks.mockStreamText.mock.calls[0]?.[0];
    expect(callArgs.temperature).toBe(0);
    expect(callArgs.seed).toBe(42);
  });
});
