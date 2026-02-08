import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks for configurable test state ---
const mocks = vi.hoisted(() => {
  const mockReflect = vi.fn();
  const mockCurate = vi.fn();
  const mockApplyUpdate = vi.fn();
  const mockSkillbookToDict = vi.fn(() => ({ skills: {} }));
  const mockSkillbookSkills = vi.fn(() => []);
  const mockDbUpdate = vi.fn();
  const mockDbInsert = vi.fn();
  const mockDbSelect = vi.fn();
  const mockSatisfactionToFeedbackSignal = vi.fn();

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
      skillbook: {
        skills: mockSkillbookSkills,
        asPrompt: () => "",
        applyUpdate: mockApplyUpdate,
        toDict: mockSkillbookToDict,
      },
      version: 0,
    },
    skillbookError: null as Error | null,
    opikClient: null as {
      searchTraces: ReturnType<typeof vi.fn>;
      trace: ReturnType<typeof vi.fn>;
      flush: ReturnType<typeof vi.fn>;
    } | null,
    dbUpdateError: null as Error | null,
    /** Controls the rowCount returned by the skillbook update query */
    skillbookUpdateRowCount: 1,
    /** If set, the skillbook update query will reject with this error */
    skillbookUpdateError: null as Error | null,
    /** If set, the insert query will reject with this error */
    dbInsertError: null as Error | null,
    mockReflect,
    mockCurate,
    mockApplyUpdate,
    mockSkillbookToDict,
    mockSkillbookSkills,
    mockDbUpdate,
    mockDbInsert,
    mockDbSelect,
    mockSatisfactionToFeedbackSignal,
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
  // biome-ignore lint/complexity/useArrowFunction: vi.fn needs function syntax for constructor
  SkillManager: vi.fn(function () {
    return { curate: mocks.mockCurate };
  }),
  VercelAIClient: vi.fn(),
  Skillbook: vi.fn(),
  wrapSkillbookContext: vi.fn(() => ""),
}));

// --- Mock @pause/db ---
vi.mock("@pause/db", () => {
  // Default chains — will be reset in beforeEach
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn(() => Promise.resolve()),
  };
  mocks.mockDbUpdate.mockReturnValue(updateChain);

  const insertChain = {
    values: vi.fn(() => Promise.resolve()),
  };
  mocks.mockDbInsert.mockReturnValue(insertChain);

  // Default select chain for ghost card / interaction lookups
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(() => Promise.resolve([])),
  };
  mocks.mockDbSelect.mockReturnValue(selectChain);

  return {
    db: {
      update: mocks.mockDbUpdate,
      insert: mocks.mockDbInsert,
      select: mocks.mockDbSelect,
    },
  };
});

vi.mock("@pause/db/schema", () => ({
  ghostCard: {
    id: "ghost_card.id",
    interactionId: "ghost_card.interactionId",
    userId: "ghost_card.userId",
  },
  interaction: {
    id: "interaction.id",
    userId: "interaction.userId",
    status: "interaction.status",
    outcome: "interaction.outcome",
    metadata: "interaction.metadata",
    reasoningSummary: "interaction.reasoningSummary",
    tier: "interaction.tier",
  },
  skillbook: {
    userId: "skillbook.userId",
    skills: "skillbook.skills",
    version: "skillbook.version",
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
  satisfactionFeedbackEnum: {
    enumValues: ["worth_it", "regret_it", "not_sure"],
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    {
      raw: vi.fn((s: string) => ({ raw: s })),
    }
  ),
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
  // biome-ignore lint/complexity/useArrowFunction: vi.fn needs function syntax for constructor
  SkillManager: vi.fn(function () {
    return { curate: mocks.mockCurate };
  }),
  Skillbook: vi.fn(),
  VercelAIClient: vi.fn(),
}));

// --- Mock ghost-cards (satisfaction mapping) ---
vi.mock("@/lib/server/ghost-cards", () => ({
  satisfactionToFeedbackSignal: mocks.mockSatisfactionToFeedbackSignal,
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
  attachSatisfactionFeedbackToTrace,
  attachSkillUpdateToTrace,
  markLearningComplete,
  runReflection,
  runSatisfactionFeedbackLearning,
  runSkillUpdate,
} from "./learning";

// Pin refs to prevent linter from stripping (used in describe blocks below)
const _satTrace = attachSatisfactionFeedbackToTrace;
const _satLearning = runSatisfactionFeedbackLearning;

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

const defaultUpdateBatch = {
  reasoning: "Tagging skill-001 as helpful based on user acceptance",
  operations: [
    {
      type: "TAG" as const,
      section: "negotiation",
      skill_id: "skill-001",
      metadata: { helpful: 1 },
    },
  ],
};

/** Helper to set up the DB update mock chain for skillbook updates */
function setupSkillbookUpdateChain() {
  let callCount = 0;
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn(() => {
      if (mocks.skillbookUpdateError) {
        return Promise.reject(mocks.skillbookUpdateError);
      }
      callCount++;
      // Return rowCount based on configurable state
      const rowCount =
        typeof mocks.skillbookUpdateRowCount === "number"
          ? mocks.skillbookUpdateRowCount
          : 1;
      return Promise.resolve({ rowCount });
    }),
  };
  mocks.mockDbUpdate.mockReturnValue(updateChain);
  return { updateChain, getCallCount: () => callCount };
}

/** Helper to set up the DB insert mock chain */
function setupSkillbookInsertChain() {
  const insertChain = {
    values: vi.fn(() => {
      if (mocks.dbInsertError) {
        return Promise.reject(mocks.dbInsertError);
      }
      return Promise.resolve();
    }),
  };
  mocks.mockDbInsert.mockReturnValue(insertChain);
  return insertChain;
}

/** Creates a LearningPipelineResult for runSkillUpdate tests */
function createPipelineResult(overrides?: {
  skillbookVersion?: number;
  skills?: Array<{ id: string }>;
}) {
  const mockSkills = overrides?.skills ?? [];
  const skillbook = {
    skills: vi.fn(() => mockSkills),
    asPrompt: () => "",
    applyUpdate: mocks.mockApplyUpdate,
    toDict: mocks.mockSkillbookToDict,
  };

  return {
    reflectionOutput: defaultReflectResult,
    interactionId: "int-500",
    userId: "user-1",
    skillbook: skillbook as never,
    skillbookVersion: overrides?.skillbookVersion ?? 1,
  };
}

describe("Learning Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reflectResult = defaultReflectResult;
    mocks.reflectError = null;
    mocks.skillbookResult = {
      skillbook: {
        skills: mocks.mockSkillbookSkills,
        asPrompt: () => "",
        applyUpdate: mocks.mockApplyUpdate,
        toDict: mocks.mockSkillbookToDict,
      },
      version: 0,
    };
    mocks.skillbookError = null;
    mocks.opikClient = null;
    mocks.dbUpdateError = null;
    mocks.skillbookUpdateRowCount = 1;
    mocks.skillbookUpdateError = null;
    mocks.dbInsertError = null;

    // Reset reflect mock behavior
    mocks.mockReflect.mockImplementation(() => {
      if (mocks.reflectError) {
        throw mocks.reflectError;
      }
      return Promise.resolve(mocks.reflectResult);
    });

    // Reset curate mock behavior
    mocks.mockCurate.mockResolvedValue(defaultUpdateBatch);

    // Reset skillbook mocks
    mocks.mockApplyUpdate.mockImplementation(() => {
      /* no-op by default */
    });
    mocks.mockSkillbookToDict.mockReturnValue({ skills: {} });
    mocks.mockSkillbookSkills.mockReturnValue([]);

    // Reset DB chains
    setupSkillbookUpdateChain();
    setupSkillbookInsertChain();
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

    it("includes skillbook and skillbookVersion in result (Story 6.3)", async () => {
      mocks.skillbookResult = {
        ...mocks.skillbookResult,
        version: 5,
      };

      const result = await runReflection({
        interactionId: "int-100b",
        userId: "user-1",
        question: "test",
        generatorAnswer: "test",
        outcome: "accepted",
      });

      expect(result).not.toBeNull();
      expect(result?.skillbook).toBe(mocks.skillbookResult.skillbook);
      expect(result?.skillbookVersion).toBe(5);
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

    it("uses customFeedback when provided instead of outcome lookup (Story 6.6)", async () => {
      await runReflection({
        interactionId: "int-107",
        userId: "user-1",
        question: "buying headphones",
        generatorAnswer: "Consider waiting",
        outcome: "accepted",
        customFeedback:
          "incorrect — user accepted but later regretted the decision",
      });

      expect(mocks.mockReflect).toHaveBeenCalledWith({
        question: "buying headphones",
        generatorAnswer: "Consider waiting",
        feedback: "incorrect — user accepted but later regretted the decision",
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
  // runSkillUpdate — Story 6.3
  // ========================================================================

  describe("runSkillUpdate", () => {
    it("calls SkillManager.curate() with reflection analysis and skillbook (AC1)", async () => {
      const pipelineResult = createPipelineResult();
      setupSkillbookUpdateChain();

      await runSkillUpdate(pipelineResult);

      expect(mocks.mockCurate).toHaveBeenCalledWith({
        reflectionAnalysis: defaultReflectResult.analysis,
        skillbook: pipelineResult.skillbook,
      });
    });

    it("applies UpdateBatch to Skillbook via applyUpdate (AC2)", async () => {
      const pipelineResult = createPipelineResult();
      setupSkillbookUpdateChain();

      await runSkillUpdate(pipelineResult);

      expect(mocks.mockApplyUpdate).toHaveBeenCalledWith(defaultUpdateBatch);
    });

    it("returns UpdateBatch on successful curation + persist (AC1-AC3)", async () => {
      const pipelineResult = createPipelineResult();
      setupSkillbookUpdateChain();

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toEqual(defaultUpdateBatch);
    });

    it("persists Skillbook to DB with optimistic locking (AC3)", async () => {
      const pipelineResult = createPipelineResult();
      setupSkillbookUpdateChain();

      await runSkillUpdate(pipelineResult);

      // Verify DB update was called (via withTimeout → db.update)
      expect(mocks.mockDbUpdate).toHaveBeenCalled();
    });

    // ========================================================================
    // Version conflict retry (AC4)
    // ========================================================================

    it("retries on version conflict: first write fails, retry succeeds (AC4)", async () => {
      const pipelineResult = createPipelineResult();

      // First call: version conflict (0 rowCount), second: success (1 rowCount)
      let attempt = 0;
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn(() => {
          attempt++;
          if (attempt === 1) {
            return Promise.resolve({ rowCount: 0 });
          }
          return Promise.resolve({ rowCount: 1 });
        }),
      };
      mocks.mockDbUpdate.mockReturnValue(updateChain);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toEqual(defaultUpdateBatch);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Version conflict on attempt 1")
      );
      // applyUpdate should have been called twice (initial + retry)
      expect(mocks.mockApplyUpdate).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it("logs RETRY_QUEUE after 3 exhausted retries (AC4)", async () => {
      const pipelineResult = createPipelineResult();

      // All attempts return 0 rowCount (persistent version conflict)
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn(() => Promise.resolve({ rowCount: 0 })),
      };
      mocks.mockDbUpdate.mockReturnValue(updateChain);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toBeNull();
      const retryCall = consoleSpy.mock.calls.find(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("RETRY_QUEUE") &&
          call[0].includes("skillbook_update")
      );
      expect(retryCall).toBeDefined();
      const jsonStr = (retryCall?.[0] as string).replace(
        "[Learning] RETRY_QUEUE: ",
        ""
      );
      const parsed = JSON.parse(jsonStr);
      expect(parsed.type).toBe("skillbook_update");
      expect(parsed.userId).toBe("user-1");
      expect(parsed.interactionId).toBe("int-500");

      consoleSpy.mockRestore();
    });

    // ========================================================================
    // SkillManager failure handling (AC6)
    // ========================================================================

    it("returns null when SkillManager.curate() throws (AC6)", async () => {
      const pipelineResult = createPipelineResult();
      mocks.mockCurate.mockRejectedValue(new Error("LLM generation failed"));

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Learning] Skill update failed"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    // ========================================================================
    // Timeout handling (AC7)
    // ========================================================================

    it("returns null when curate() times out (AC7)", async () => {
      const pipelineResult = createPipelineResult();
      mocks.mockCurate.mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          })
      );

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Learning] Skill update failed"),
        expect.objectContaining({
          message: "SkillManager curation timed out",
        })
      );

      consoleSpy.mockRestore();
    }, 15_000);

    // ========================================================================
    // Empty UpdateBatch
    // ========================================================================

    it("persists Skillbook even with empty UpdateBatch (no operations)", async () => {
      const emptyBatch = { reasoning: "No changes needed", operations: [] };
      mocks.mockCurate.mockResolvedValue(emptyBatch);
      const pipelineResult = createPipelineResult();
      setupSkillbookUpdateChain();

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toEqual(emptyBatch);
      // applyUpdate should still be called with the empty batch
      expect(mocks.mockApplyUpdate).toHaveBeenCalledWith(emptyBatch);
      // DB update should still happen
      expect(mocks.mockDbUpdate).toHaveBeenCalled();
    });

    // ========================================================================
    // Opik trace creation (AC5)
    // ========================================================================

    it("creates learning:skillbook_update Opik trace on success (AC5)", async () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn().mockResolvedValue([]),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      const pipelineResult = createPipelineResult({
        skills: [{ id: "s1" }, { id: "s2" }],
      });
      setupSkillbookUpdateChain();

      await runSkillUpdate(pipelineResult);

      expect(mocks.opikClient.trace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "learning:skillbook_update",
          input: expect.objectContaining({
            interactionId: "int-500",
            operationCount: 1,
            reasoning: defaultUpdateBatch.reasoning,
          }),
          tags: ["learning", "skillbook_update"],
        })
      );
      expect(mockTrace.end).toHaveBeenCalled();
    });

    // ========================================================================
    // INSERT path for new users (AC3 edge case)
    // ========================================================================

    it("inserts new skillbook row when version=0 and UPDATE returns 0 rows", async () => {
      const pipelineResult = createPipelineResult({ skillbookVersion: 0 });

      // UPDATE returns 0 rowCount (no existing row)
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn(() => Promise.resolve({ rowCount: 0 })),
      };
      mocks.mockDbUpdate.mockReturnValue(updateChain);

      const insertChain = setupSkillbookInsertChain();

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toEqual(defaultUpdateBatch);
      expect(mocks.mockDbInsert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          version: 1,
        })
      );

      consoleSpy.mockRestore();
    });

    it("falls back to retry loop when INSERT fails on version=0", async () => {
      const pipelineResult = createPipelineResult({ skillbookVersion: 0 });

      // INSERT throws (DB error, not just a race condition)
      mocks.dbInsertError = new Error("DB connection lost");
      setupSkillbookInsertChain();

      // First UPDATE: 0 rows (triggers INSERT path which fails)
      // Second UPDATE (after reload with version=1): success
      let attempt = 0;
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn(() => {
          attempt++;
          if (attempt === 1) {
            return Promise.resolve({ rowCount: 0 });
          }
          return Promise.resolve({ rowCount: 1 });
        }),
      };
      mocks.mockDbUpdate.mockReturnValue(updateChain);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toEqual(defaultUpdateBatch);
      // INSERT was attempted and failed
      expect(mocks.mockDbInsert).toHaveBeenCalled();
      // Recovery happened via UPDATE retry
      expect(attempt).toBe(2);

      consoleSpy.mockRestore();
    });

    // ========================================================================
    // Re-apply after version conflict (no duplicates)
    // ========================================================================

    it("re-applies UpdateBatch to fresh Skillbook on retry without duplicates", async () => {
      const pipelineResult = createPipelineResult({
        skills: [{ id: "skill-001" }],
      });

      // First attempt fails (version conflict), second succeeds
      let attempt = 0;
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn(() => {
          attempt++;
          if (attempt === 1) {
            return Promise.resolve({ rowCount: 0 });
          }
          return Promise.resolve({ rowCount: 1 });
        }),
      };
      mocks.mockDbUpdate.mockReturnValue(updateChain);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toEqual(defaultUpdateBatch);
      // applyUpdate called on initial skillbook AND on fresh reload skillbook
      expect(mocks.mockApplyUpdate).toHaveBeenCalledTimes(2);
      // Both calls receive the same UpdateBatch
      expect(mocks.mockApplyUpdate).toHaveBeenNthCalledWith(
        1,
        defaultUpdateBatch
      );
      expect(mocks.mockApplyUpdate).toHaveBeenNthCalledWith(
        2,
        defaultUpdateBatch
      );

      consoleSpy.mockRestore();
    });

    // ========================================================================
    // Malformed UpdateBatch resilience
    // ========================================================================

    it("handles malformed UpdateBatch gracefully (AC10)", async () => {
      const malformedBatch = {
        reasoning: "test",
        operations: [{ type: "UNKNOWN_OP", section: "test" }, { type: "TAG" }],
      };
      mocks.mockCurate.mockResolvedValue(malformedBatch);
      const pipelineResult = createPipelineResult();
      setupSkillbookUpdateChain();

      // applyUpdate might throw on malformed data — the outer catch should handle it
      mocks.mockApplyUpdate.mockImplementation(() => {
        // Skillbook.applyUpdate() silently ignores unknown operation types per ACE framework
      });

      const result = await runSkillUpdate(pipelineResult);

      // Should still succeed since applyUpdate handles it gracefully
      expect(result).toEqual(malformedBatch);
      expect(mocks.mockApplyUpdate).toHaveBeenCalledWith(malformedBatch);
    });

    it("returns null when applyUpdate throws on truly broken batch", async () => {
      mocks.mockCurate.mockResolvedValue(defaultUpdateBatch);
      const pipelineResult = createPipelineResult();
      mocks.mockApplyUpdate.mockImplementation(() => {
        throw new TypeError("Cannot read properties of undefined");
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Learning] Skill update failed"),
        expect.any(TypeError)
      );

      consoleSpy.mockRestore();
    });

    // ========================================================================
    // DB persistence failure after successful curation (AC6)
    // ========================================================================

    it("returns null when DB persistSkillbookUpdate throws (AC6)", async () => {
      const pipelineResult = createPipelineResult();
      mocks.skillbookUpdateError = new Error("DB connection lost");
      setupSkillbookUpdateChain();

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      const result = await runSkillUpdate(pipelineResult);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Learning] Skill update failed"),
        expect.any(Error)
      );
      // curate succeeded and applyUpdate was called before DB failed
      expect(mocks.mockCurate).toHaveBeenCalled();
      expect(mocks.mockApplyUpdate).toHaveBeenCalledWith(defaultUpdateBatch);

      consoleSpy.mockRestore();
    });
  });

  // ========================================================================
  // attachSkillUpdateToTrace — Opik trace for skill updates (AC5)
  // ========================================================================

  describe("attachSkillUpdateToTrace", () => {
    it("creates learning:skillbook_update trace with correct metadata", () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn(),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      attachSkillUpdateToTrace("int-600", defaultUpdateBatch, 3, 4);

      expect(mocks.opikClient.trace).toHaveBeenCalledWith({
        name: "learning:skillbook_update",
        input: expect.objectContaining({
          interactionId: "int-600",
          operationCount: 1,
          skillCountBefore: 3,
          skillCountAfter: 4,
          reasoning: defaultUpdateBatch.reasoning,
          operations: [
            {
              type: "TAG",
              section: "negotiation",
              skill_id: "skill-001",
            },
          ],
        }),
        tags: ["learning", "skillbook_update"],
        metadata: { interactionId: "int-600" },
      });
      expect(mockTrace.end).toHaveBeenCalled();
    });

    it("does nothing when Opik client is null", () => {
      mocks.opikClient = null;

      // Should not throw
      attachSkillUpdateToTrace("int-601", defaultUpdateBatch, 0, 1);
    });

    it("does not throw when flush fails", () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn(),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockRejectedValue(new Error("flush failed")),
      };

      // Should not throw
      attachSkillUpdateToTrace("int-602", defaultUpdateBatch, 0, 1);
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
        filterString: 'metadata.interactionId = "int-200"',
        waitForAtLeast: 1,
        waitForTimeout: 5000,
      });
      expect(mocks.opikClient.trace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "learning:reflection",
          input: expect.objectContaining({
            interactionId: "int-200",
            parentTraceId: "trace-001",
            reflectionAnalysis: defaultReflectResult.analysis,
          }),
          tags: ["learning", "reflection"],
          metadata: { interactionId: "int-200" },
        })
      );
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

  // ========================================================================
  // attachSatisfactionFeedbackToTrace — Story 6.6 (AC4)
  // ========================================================================

  describe("attachSatisfactionFeedbackToTrace", () => {
    it("uses metadata-based search pattern (Story 8.2, AC#9)", async () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn().mockResolvedValue([{ id: "trace-parent" }]),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      await _satTrace("int-710", {
        satisfactionFeedback: "worth_it",
        originalOutcome: "accepted",
        mappedSignal: "correct",
        reflectionAnalysis: "test",
        newLearnings: [],
      });

      expect(mocks.opikClient.searchTraces).toHaveBeenCalledWith({
        filterString: 'metadata.interactionId = "int-710"',
        waitForAtLeast: 1,
        waitForTimeout: 5000,
      });
    });

    it("creates learning:satisfaction_feedback trace with metadata", async () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn().mockResolvedValue([{ id: "trace-parent" }]),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      await _satTrace("int-700", {
        satisfactionFeedback: "regret_it",
        originalOutcome: "accepted",
        mappedSignal: "incorrect — user regrets following suggestion",
        reflectionAnalysis: "Strategy was ineffective",
        newLearnings: [{ section: "negotiation", content: "test" }],
      });

      expect(mocks.opikClient.trace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "learning:satisfaction_feedback",
          input: expect.objectContaining({
            interactionId: "int-700",
            parentTraceId: "trace-parent",
            satisfactionFeedback: "regret_it",
            originalOutcome: "accepted",
            mappedSignal: "incorrect — user regrets following suggestion",
          }),
          tags: ["learning", "satisfaction_feedback"],
          metadata: { interactionId: "int-700" },
        })
      );
      expect(mockTrace.end).toHaveBeenCalled();
      expect(mocks.opikClient.flush).toHaveBeenCalled();
    });

    it("does nothing when Opik client is null", async () => {
      mocks.opikClient = null;

      // Should not throw
      await _satTrace("int-701", {
        satisfactionFeedback: "worth_it",
        originalOutcome: "overridden",
        mappedSignal: "test",
        reflectionAnalysis: "test",
        newLearnings: [],
      });
    });

    it("does not create trace when guardian trace not found", async () => {
      mocks.opikClient = {
        searchTraces: vi.fn().mockResolvedValue([]),
        trace: vi.fn(),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      await _satTrace("int-702", {
        satisfactionFeedback: "worth_it",
        originalOutcome: "accepted",
        mappedSignal: "test",
        reflectionAnalysis: "test",
        newLearnings: [],
      });

      expect(mocks.opikClient.trace).not.toHaveBeenCalled();
      expect(mocks.opikClient.flush).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // runSatisfactionFeedbackLearning — Story 6.6 orchestration (AC1/3/4/6)
  // ========================================================================

  describe("runSatisfactionFeedbackLearning", () => {
    /** Helper to set up the select chain for ghost card + interaction lookups */
    function setupGhostCardAndInteraction(
      gcResult: Record<string, unknown>[] = [{ interactionId: "int-800" }],
      intResult: Record<string, unknown>[] = [
        {
          outcome: "accepted",
          reasoningSummary: "Consider waiting for a sale",
          metadata: { purchaseContext: "buying headphones" },
        },
      ]
    ) {
      let selectCallCount = 0;
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return Promise.resolve(gcResult);
          }
          return Promise.resolve(intResult);
        }),
      };
      mocks.mockDbSelect.mockReturnValue(selectChain);
      return selectChain;
    }

    beforeEach(() => {
      mocks.mockSatisfactionToFeedbackSignal.mockReturnValue(
        "incorrect — user accepted but later regretted"
      );
    });

    it("runs full pipeline: lookup -> signal -> Reflector -> SkillManager -> trace", async () => {
      setupGhostCardAndInteraction();
      setupSkillbookUpdateChain();

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      await _satLearning({
        ghostCardId: "gc-100",
        userId: "user-1",
        satisfactionFeedback: "regret_it",
      });

      // Signal mapping called
      expect(mocks.mockSatisfactionToFeedbackSignal).toHaveBeenCalledWith(
        "regret_it",
        "accepted"
      );

      // Reflector called with customFeedback
      expect(mocks.mockReflect).toHaveBeenCalled();

      // SkillManager curation called (verifies full pipeline completion)
      expect(mocks.mockCurate).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("skips gracefully when ghost card not found", async () => {
      setupGhostCardAndInteraction([]);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      await _satLearning({
        ghostCardId: "gc-missing",
        userId: "user-1",
        satisfactionFeedback: "worth_it",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SatisfactionLearning]")
      );
      expect(mocks.mockReflect).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("skips gracefully when interaction not found", async () => {
      setupGhostCardAndInteraction([{ interactionId: "int-800" }], []);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      await _satLearning({
        ghostCardId: "gc-101",
        userId: "user-1",
        satisfactionFeedback: "regret_it",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SatisfactionLearning]")
      );
      expect(mocks.mockReflect).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("logs warning and does not throw on Reflector failure", async () => {
      setupGhostCardAndInteraction();
      mocks.reflectError = new Error("LLM API error");
      mocks.mockReflect.mockImplementation(() => {
        throw mocks.reflectError;
      });

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      // Should NOT throw
      await _satLearning({
        ghostCardId: "gc-102",
        userId: "user-1",
        satisfactionFeedback: "worth_it",
      });

      // Learning warn logs exist (from runReflection's catch)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Learning]"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("logs warning on DB error and does not throw", async () => {
      // Make select throw
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn(() => Promise.reject(new Error("DB timeout"))),
      };
      mocks.mockDbSelect.mockReturnValue(selectChain);

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });

      // Should NOT throw
      await _satLearning({
        ghostCardId: "gc-103",
        userId: "user-1",
        satisfactionFeedback: "regret_it",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SatisfactionLearning] Pipeline failed"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  // ========================================================================
  // Story 8.5b: Learning Visualization for Judges — enriched trace metadata
  // ========================================================================

  describe("Story 8.5b: Learning trace enrichments", () => {
    it("attachReflectionToTrace includes tier and outcome when provided", async () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn().mockResolvedValue([{ id: "trace-8b-1" }]),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      await attachReflectionToTrace("int-8b-1", defaultReflectResult, {
        tier: "therapist",
        outcome: "overridden",
      });

      const traceCall = mocks.opikClient.trace.mock.calls[0][0];
      expect(traceCall.input.tier).toBe("therapist");
      expect(traceCall.input.outcome).toBe("overridden");
    });

    it("attachReflectionToTrace includes tags and metadata with interactionId", async () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn().mockResolvedValue([{ id: "trace-8b-2" }]),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      await attachReflectionToTrace("int-8b-2", defaultReflectResult);

      const traceCall = mocks.opikClient.trace.mock.calls[0][0];
      expect(traceCall.tags).toEqual(["learning", "reflection"]);
      expect(traceCall.metadata).toEqual({ interactionId: "int-8b-2" });
    });

    it("attachSkillUpdateToTrace includes delta and operationsByType", () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn(),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      const batchWithMixedOps = {
        reasoning: "Multiple operations",
        operations: [
          {
            type: "ADD" as const,
            section: "future_self",
            content: "new skill",
          },
          {
            type: "TAG" as const,
            section: "negotiation",
            skill_id: "s-1",
            metadata: { helpful: 1 },
          },
          {
            type: "TAG" as const,
            section: "negotiation",
            skill_id: "s-2",
            metadata: { harmful: 1 },
          },
        ],
      };

      attachSkillUpdateToTrace(
        "int-8b-3",
        batchWithMixedOps as import("@pause/ace").UpdateBatch,
        5,
        6
      );

      const traceCall = mocks.opikClient.trace.mock.calls[0][0];
      expect(traceCall.input.delta).toBe(1);
      expect(traceCall.input.operationsByType).toEqual({ ADD: 1, TAG: 2 });
    });

    it("attachSkillUpdateToTrace includes skillbook_snapshot when skillbook provided", () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn(),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      const mockSkillbook = {
        skills: vi.fn(() => [
          {
            id: "s1",
            section: "future_self",
            content: "test",
            helpful: 3,
            harmful: 1,
            neutral: 0,
            created_at: "",
            updated_at: "",
            status: "active" as const,
          },
          {
            id: "s2",
            section: "future_self",
            content: "test2",
            helpful: 1,
            harmful: 0,
            neutral: 2,
            created_at: "",
            updated_at: "",
            status: "active" as const,
          },
          {
            id: "s3",
            section: "cost_analysis",
            content: "test3",
            helpful: 2,
            harmful: 2,
            neutral: 1,
            created_at: "",
            updated_at: "",
            status: "active" as const,
          },
        ]),
        asPrompt: () => "",
        applyUpdate: vi.fn(),
        toDict: vi.fn(),
      } as never;

      attachSkillUpdateToTrace(
        "int-8b-4",
        defaultUpdateBatch,
        2,
        3,
        mockSkillbook
      );

      const traceCall = mocks.opikClient.trace.mock.calls[0][0];
      expect(traceCall.input.skillbook_snapshot).toEqual({
        activeSkillsBySection: { future_self: 2, cost_analysis: 1 },
        totalHelpful: 6,
        totalHarmful: 3,
        totalNeutral: 3,
      });
    });

    it("attachSkillUpdateToTrace includes tags with learning and skillbook_update", () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn(),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      attachSkillUpdateToTrace("int-8b-5", defaultUpdateBatch, 0, 1);

      const traceCall = mocks.opikClient.trace.mock.calls[0][0];
      expect(traceCall.tags).toEqual(["learning", "skillbook_update"]);
      expect(traceCall.metadata).toEqual({ interactionId: "int-8b-5" });
    });

    it("attachSatisfactionFeedbackToTrace includes tags", async () => {
      const mockTrace = { end: vi.fn() };
      mocks.opikClient = {
        searchTraces: vi.fn().mockResolvedValue([{ id: "trace-8b-6" }]),
        trace: vi.fn().mockReturnValue(mockTrace),
        flush: vi.fn().mockResolvedValue(undefined),
      };

      await _satTrace("int-8b-6", {
        satisfactionFeedback: "worth_it",
        originalOutcome: "accepted",
        mappedSignal: "correct",
        reflectionAnalysis: "test",
        newLearnings: [],
      });

      const traceCall = mocks.opikClient.trace.mock.calls[0][0];
      expect(traceCall.tags).toEqual(["learning", "satisfaction_feedback"]);
      expect(traceCall.metadata).toEqual({ interactionId: "int-8b-6" });
    });
  });
});
