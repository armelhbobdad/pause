import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockReflect = vi.fn();
  const mockDbUpdate = vi.fn();

  return {
    reflectResult: null as {
      analysis: string;
      helpful_skill_ids: string[];
      harmful_skill_ids: string[];
      new_learnings: Array<{
        section: string;
        content: string;
        atomicity_score: number;
      }>;
    } | null,
    reflectError: null as Error | null,
    skillbookResult: {
      skillbook: { skills: () => [], asPrompt: () => "" },
      version: 0,
    },
    skillbookError: null as Error | null,
    opikClient: null as {
      searchTraces: ReturnType<typeof vi.fn>;
      trace: ReturnType<typeof vi.fn>;
      flush: ReturnType<typeof vi.fn>;
    } | null,
    dbUpdateError: null as Error | null,
    mockReflect,
    mockDbUpdate,
  };
});

// --- Mock server-only ---
vi.mock("server-only", () => ({}));

// --- Mock @ai-sdk/google ---
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-gemini-model"),
}));

// --- Mock @pause/ace (for re-export path) ---
vi.mock("@pause/ace", () => ({
  // biome-ignore lint/complexity/useArrowFunction: vi.fn needs function syntax for constructor
  Reflector: vi.fn(function () {
    return { reflect: mocks.mockReflect };
  }),
  VercelAIClient: vi.fn(),
  Skillbook: vi.fn(),
  wrapSkillbookContext: vi.fn(() => ""),
}));

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn(() => {
      if (mocks.dbUpdateError) {
        return Promise.reject(mocks.dbUpdateError);
      }
      return Promise.resolve();
    }),
  };
  mocks.mockDbUpdate.mockReturnValue(updateChain);

  return {
    db: {
      update: mocks.mockDbUpdate,
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
  interactionOutcomeEnum: {
    enumValues: [
      "accepted",
      "overridden",
      "abandoned",
      "timeout",
      "auto_approved",
      "break_glass",
      "wait",
      "wizard_bookmark",
      "wizard_abandoned",
    ],
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

// --- Mock ace adapter (this is what learning.ts actually imports) ---
vi.mock("@/lib/server/ace", () => ({
  loadUserSkillbookInstance: vi.fn().mockImplementation(() => {
    if (mocks.skillbookError) {
      return Promise.reject(mocks.skillbookError);
    }
    return Promise.resolve(mocks.skillbookResult);
  }),
  // biome-ignore lint/complexity/useArrowFunction: vi.fn needs function syntax for constructor
  Reflector: vi.fn(function () {
    return { reflect: mocks.mockReflect };
  }),
  VercelAIClient: vi.fn(),
}));

// --- Mock opik ---
vi.mock("@/lib/server/opik", () => ({
  getOpikClient: vi.fn(() => mocks.opikClient),
}));

// --- Mock @/lib/server/utils ---
vi.mock("@/lib/server/utils", () => ({
  withTimeout: vi.fn(<T>(promise: Promise<T>, _ms: number) => promise),
}));

// --- Import the module under test ---
import {
  attachReflectionToTrace,
  markLearningComplete,
  runReflection,
} from "./learning";

const defaultReflectResult = {
  analysis: "The user accepted the suggestion, indicating effective strategy",
  helpful_skill_ids: ["skill-001"],
  harmful_skill_ids: [],
  new_learnings: [
    {
      section: "negotiation",
      content: "Direct savings presentation works well",
      atomicity_score: 0.8,
    },
  ],
};

describe("Learning Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reflectResult = defaultReflectResult;
    mocks.reflectError = null;
    mocks.skillbookResult = {
      skillbook: { skills: () => [], asPrompt: () => "" },
      version: 0,
    };
    mocks.skillbookError = null;
    mocks.opikClient = null;
    mocks.dbUpdateError = null;

    // Reset reflect mock behavior
    mocks.mockReflect.mockImplementation(() => {
      if (mocks.reflectError) {
        throw mocks.reflectError;
      }
      return Promise.resolve(mocks.reflectResult);
    });

    // Reset DB update mock chain
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn(() => {
        if (mocks.dbUpdateError) {
          return Promise.reject(mocks.dbUpdateError);
        }
        return Promise.resolve();
      }),
    };
    mocks.mockDbUpdate.mockReturnValue(updateChain);
  });

  // ========================================================================
  // runReflection — successful reflection
  // ========================================================================

  describe("runReflection", () => {
    it("returns LearningPipelineResult on successful reflection", async () => {
      const result = await runReflection({
        interactionId: "int-100",
        userId: "user-1",
        question: "buying headphones online",
        generatorAnswer: "Consider waiting for a sale",
        outcome: "accepted",
      });

      expect(result).not.toBeNull();
      expect(result?.interactionId).toBe("int-100");
      expect(result?.userId).toBe("user-1");
      expect(result?.reflectionOutput.analysis).toBe(
        defaultReflectResult.analysis
      );
      expect(result?.reflectionOutput.helpful_skill_ids).toEqual(["skill-001"]);
      expect(result?.reflectionOutput.new_learnings).toHaveLength(1);
    });

    it("loads user Skillbook for reflection", async () => {
      const { loadUserSkillbookInstance } = await import("@/lib/server/ace");
      await runReflection({
        interactionId: "int-101",
        userId: "user-1",
        question: "test",
        generatorAnswer: "test",
        outcome: "accepted",
      });

      expect(loadUserSkillbookInstance).toHaveBeenCalledWith("user-1");
    });

    it("passes correct parameters to Reflector.reflect()", async () => {
      await runReflection({
        interactionId: "int-106",
        userId: "user-1",
        question: "buying shoes",
        generatorAnswer: "Try waiting for a deal",
        outcome: "overridden",
      });

      expect(mocks.mockReflect).toHaveBeenCalledWith({
        question: "buying shoes",
        generatorAnswer: "Try waiting for a deal",
        feedback: "incorrect — user overrode the Guardian's suggestion",
        skillbook: mocks.skillbookResult.skillbook,
      });
    });

    // ========================================================================
    // runReflection — failure handling
    // ========================================================================

    it("returns null when Reflector throws", async () => {
      mocks.reflectError = new Error("LLM API error");
      mocks.mockReflect.mockImplementation(() => {
        throw mocks.reflectError;
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runReflection({
        interactionId: "int-102",
        userId: "user-1",
        question: "test",
        generatorAnswer: "test",
        outcome: "overridden",
      });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Learning] Reflection failed"),
        expect.any(Error)
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("RETRY_QUEUE")
      );

      consoleSpy.mockRestore();
    });

    it("returns null when Skillbook loading fails", async () => {
      mocks.skillbookError = new Error("DB connection failed");

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runReflection({
        interactionId: "int-103",
        userId: "user-1",
        question: "test",
        generatorAnswer: "test",
        outcome: "wait",
      });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Learning] Reflection failed"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    // ========================================================================
    // runReflection — timeout handling
    // ========================================================================

    it("returns null when reflection times out", async () => {
      // Make reflect return a promise that never resolves
      mocks.mockReflect.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runReflection({
        interactionId: "int-104",
        userId: "user-1",
        question: "test",
        generatorAnswer: "test",
        outcome: "abandoned",
      });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Learning] Reflection failed"),
        expect.objectContaining({ message: "Reflection timed out" })
      );

      consoleSpy.mockRestore();
    }, 15_000);

    it("logs RETRY_QUEUE JSON on failure with correct structure", async () => {
      mocks.reflectError = new Error("API rate limit");
      mocks.mockReflect.mockImplementation(() => {
        throw mocks.reflectError;
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      await runReflection({
        interactionId: "int-105",
        userId: "user-2",
        question: "test",
        generatorAnswer: "test",
        outcome: "overridden",
      });

      const retryCall = consoleSpy.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("RETRY_QUEUE")
      );
      expect(retryCall).toBeDefined();

      const jsonStr = (retryCall?.[0] as string).replace(
        "[Learning] RETRY_QUEUE: ",
        ""
      );
      const parsed = JSON.parse(jsonStr);
      expect(parsed.interactionId).toBe("int-105");
      expect(parsed.userId).toBe("user-2");
      expect(parsed.timestamp).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  // ========================================================================
  // attachReflectionToTrace — Opik trace attachment
  // ========================================================================

  describe("attachReflectionToTrace", () => {
    it("creates learning trace when guardian trace found", async () => {
      const mockTrace = {
        end: vi.fn(),
      };
      mocks.opikClient = {
        searchTraces: vi.fn().mockResolvedValue([{ id: "trace-001" }]),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      await attachReflectionToTrace("int-200", defaultReflectResult);

      expect(mocks.opikClient.searchTraces).toHaveBeenCalledWith({
        filterString: 'name = "guardian-int-200"',
        waitForAtLeast: 1,
        waitForTimeout: 5000,
      });
      expect(mocks.opikClient.trace).toHaveBeenCalledWith({
        name: "learning:reflection",
        input: expect.objectContaining({
          interactionId: "int-200",
          parentTraceId: "trace-001",
          reflectionAnalysis: defaultReflectResult.analysis,
        }),
      });
      expect(mockTrace.end).toHaveBeenCalled();
      expect(mocks.opikClient.flush).toHaveBeenCalled();
    });

    it("does nothing when Opik client is null (dev mode)", async () => {
      mocks.opikClient = null;

      // Should not throw
      await attachReflectionToTrace("int-201", defaultReflectResult);
    });

    it("does nothing when guardian trace not found", async () => {
      mocks.opikClient = {
        searchTraces: vi.fn().mockResolvedValue([]),
        trace: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      await attachReflectionToTrace("int-202", defaultReflectResult);

      expect(mocks.opikClient.trace).not.toHaveBeenCalled();
      expect(mocks.opikClient.flush).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // markLearningComplete — status update
  // ========================================================================

  describe("markLearningComplete", () => {
    it("updates interaction status to learning_complete", async () => {
      await markLearningComplete("int-300");

      expect(mocks.mockDbUpdate).toHaveBeenCalled();
      const updateReturn = mocks.mockDbUpdate.mock.results[0]?.value;
      expect(updateReturn?.set).toHaveBeenCalledWith({
        status: "learning_complete",
      });
    });

    it("throws when DB update fails", async () => {
      mocks.dbUpdateError = new Error("DB write failed");

      // Reset chain with error
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn(() => Promise.reject(mocks.dbUpdateError)),
      };
      mocks.mockDbUpdate.mockReturnValue(updateChain);

      await expect(markLearningComplete("int-301")).rejects.toThrow(
        "DB write failed"
      );
    });
  });
});
