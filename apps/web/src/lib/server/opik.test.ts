import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRACE_NAMES } from "@/lib/guardian/trace-names";

// --- Hoisted mocks ---
const mocks = vi.hoisted(() => ({
  traces: [] as Array<{ name: string; input: Record<string, unknown> }>,
  flush: vi.fn().mockResolvedValue(undefined),
  traceEnd: vi.fn(),
  traceUpdate: vi.fn(),
  searchTraces: vi.fn().mockResolvedValue([{ id: "trace-123" }]),
  OpikConstructor: vi.fn(),
  logTracesFeedbackScores: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("opik", () => {
  class MockOpik {
    constructor(...args: unknown[]) {
      mocks.OpikConstructor(...args);
    }
    trace = vi.fn((data: { name: string; input?: Record<string, unknown> }) => {
      mocks.traces.push({ name: data.name, input: data.input ?? {} });
      return { end: mocks.traceEnd, update: mocks.traceUpdate };
    });
    flush = mocks.flush;
    searchTraces = mocks.searchTraces;
    logTracesFeedbackScores = mocks.logTracesFeedbackScores;
  }
  return { Opik: MockOpik };
});

vi.mock("opik-vercel", () => ({
  OpikExporter: {
    getSettings: (s: { name?: string }) => ({
      isEnabled: true,
      recordInputs: true,
      recordOutputs: true,
      functionId: s.name,
    }),
  },
}));

describe("getGuardianTelemetry", () => {
  let getGuardianTelemetry: typeof import("./opik").getGuardianTelemetry;

  beforeEach(async () => {
    mocks.traces = [];
    mocks.flush.mockClear();
    mocks.traceEnd.mockClear();
    mocks.OpikConstructor.mockClear();
    const mod = await import("./opik");
    getGuardianTelemetry = mod.getGuardianTelemetry;
  });

  it("returns auto_approved trace name for auto-approved interactions", () => {
    const result = getGuardianTelemetry(
      "int-001",
      { score: 20, reasoning: "low risk" },
      "analyst",
      true
    );
    expect(result.functionId).toBe(TRACE_NAMES.ANALYST_AUTO_APPROVED);
  });

  it("returns system_failure:analyst_only trace name for degraded analyst", () => {
    const result = getGuardianTelemetry(
      "int-002",
      undefined,
      "analyst",
      false,
      {
        level: "analyst_only",
        reason: "stream failure",
      }
    );
    expect(result.functionId).toBe(TRACE_NAMES.SYSTEM_FAILURE_ANALYST_ONLY);
  });

  it("returns system_failure:break_glass trace name for degraded non-analyst", () => {
    const result = getGuardianTelemetry(
      "int-003",
      undefined,
      "therapist",
      false,
      { level: "break_glass", reason: "model timeout" }
    );
    expect(result.functionId).toBe(TRACE_NAMES.SYSTEM_FAILURE_BREAK_GLASS);
  });

  it("returns outcome-based trace name when outcome is provided", () => {
    const result = getGuardianTelemetry(
      "int-004",
      { score: 80, reasoning: "high risk" },
      "therapist",
      false,
      undefined,
      "wait"
    );
    expect(result.functionId).toBe(TRACE_NAMES.THERAPIST_WAIT);
  });

  it("returns negotiator outcome-based trace name", () => {
    const result = getGuardianTelemetry(
      "int-005",
      { score: 50, reasoning: "medium risk" },
      "negotiator",
      false,
      undefined,
      "accepted_savings"
    );
    expect(result.functionId).toBe(TRACE_NAMES.NEGOTIATOR_ACCEPTED_SAVINGS);
  });

  it("returns tier-prefixed fallback when outcome is unknown", () => {
    const result = getGuardianTelemetry(
      "int-006",
      { score: 70, reasoning: "elevated risk" },
      "therapist",
      false
    );
    expect(result.functionId).toBe("guardian:therapist:int-006");
  });

  it("returns unknown-prefixed fallback when tier is also missing", () => {
    const result = getGuardianTelemetry("int-007");
    expect(result.functionId).toBe("guardian:unknown:int-007");
  });

  it("includes metadata with interactionId and risk data", () => {
    const result = getGuardianTelemetry(
      "int-008",
      { score: 55, reasoning: "moderate risk" },
      "negotiator",
      false
    );
    expect(result.metadata).toEqual(
      expect.objectContaining({
        interactionId: "int-008",
        risk_score: 55,
        riskReasoning: "moderate risk",
        tier: "negotiator",
      })
    );
  });

  it("includes degradation metadata when degraded", () => {
    const result = getGuardianTelemetry(
      "int-009",
      undefined,
      "analyst",
      false,
      {
        level: "analyst_only",
        reason: "timeout",
      }
    );
    expect(result.metadata).toEqual(
      expect.objectContaining({
        degraded: true,
        degradationLevel: "analyst_only",
        failureReason: "timeout",
      })
    );
  });
});

describe("getOpikClient", () => {
  it("returns null when OPIK_API_KEY is not set", async () => {
    vi.stubEnv("OPIK_API_KEY", "");
    vi.resetModules();
    const { getOpikClient } = await import("./opik");
    expect(getOpikClient()).toBeNull();
    vi.unstubAllEnvs();
  });

  it("creates client with correct project name from env", async () => {
    vi.stubEnv("OPIK_API_KEY", "test-key-123");
    vi.stubEnv("OPIK_PROJECT_NAME", "test-project");
    vi.resetModules();
    mocks.OpikConstructor.mockClear();
    const { getOpikClient } = await import("./opik");
    getOpikClient();
    expect(mocks.OpikConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "test-key-123",
        projectName: "test-project",
      })
    );
    vi.unstubAllEnvs();
  });
});

describe("logDegradationTrace", () => {
  let logDegradationTrace: typeof import("./opik").logDegradationTrace;

  beforeEach(async () => {
    mocks.traces = [];
    mocks.flush.mockClear();
    mocks.traceEnd.mockClear();
    vi.stubEnv("OPIK_API_KEY", "test-key");
    vi.resetModules();
    const mod = await import("./opik");
    logDegradationTrace = mod.logDegradationTrace;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates trace with SYSTEM_FAILURE_ANALYST_ONLY name", async () => {
    await logDegradationTrace("int-010", "analyst_only", "timeout");
    expect(mocks.traces).toHaveLength(1);
    expect(mocks.traces[0].name).toBe(TRACE_NAMES.SYSTEM_FAILURE_ANALYST_ONLY);
  });

  it("creates trace with SYSTEM_FAILURE_BREAK_GLASS name", async () => {
    await logDegradationTrace("int-011", "break_glass", "model error");
    expect(mocks.traces).toHaveLength(1);
    expect(mocks.traces[0].name).toBe(TRACE_NAMES.SYSTEM_FAILURE_BREAK_GLASS);
  });

  it("calls flush after trace.end", async () => {
    await logDegradationTrace("int-012", "analyst_only", "timeout");
    expect(mocks.traceEnd).toHaveBeenCalled();
    expect(mocks.flush).toHaveBeenCalled();
  });

  it("includes risk metadata in trace input", async () => {
    await logDegradationTrace("int-013", "break_glass", "error", {
      score: 90,
      reasoning: "very high risk",
    });
    expect(mocks.traces[0].input).toEqual(
      expect.objectContaining({
        interactionId: "int-013",
        riskScore: 90,
        riskReasoning: "very high risk",
        degraded: true,
        degradationLevel: "break_glass",
      })
    );
  });

  it("swallows errors silently", async () => {
    mocks.flush.mockRejectedValueOnce(new Error("network failure"));
    await expect(
      logDegradationTrace("int-014", "analyst_only", "timeout")
    ).resolves.toBeUndefined();
  });

  it("returns early when no Opik client (no API key)", async () => {
    vi.stubEnv("OPIK_API_KEY", "");
    vi.resetModules();
    const mod = await import("./opik");
    mocks.traces = [];
    await mod.logDegradationTrace("int-015", "analyst_only", "timeout");
    expect(mocks.traces).toHaveLength(0);
  });

  it("includes reasoning_summary in degradation trace input", async () => {
    await logDegradationTrace(
      "int-016",
      "analyst_only",
      "model timeout",
      {
        score: 45,
        reasoning: "moderate risk",
      },
      "negotiator"
    );
    expect(mocks.traces).toHaveLength(1);
    const input = mocks.traces[0].input;
    expect(input.reasoning_summary).toBeDefined();
    expect(typeof input.reasoning_summary).toBe("string");
    expect(input.reasoning_summary).toContain("System failure");
    expect(input.reasoning_summary).toContain("analyst_only");
  });
});

// ========================================================================
// buildReasoningSummary — Story 8.2 (FR32, NFR-O2, NFR-T6)
// ========================================================================

describe("buildReasoningSummary", () => {
  let buildReasoningSummary: typeof import("./opik").buildReasoningSummary;

  beforeEach(async () => {
    const mod = await import("./opik");
    buildReasoningSummary = mod.buildReasoningSummary;
  });

  it("returns correct analyst summary with score and context", () => {
    const result = buildReasoningSummary({
      tier: "analyst",
      riskScore: 23,
      purchaseContext: "grocery store, $45",
      isAutoApproved: true,
    });
    expect(result).toContain("Low-risk unlock request (score: 23)");
    expect(result).toContain("grocery store, $45");
    expect(result).toContain("Auto-approved without intervention");
  });

  it("returns correct negotiator summary", () => {
    const result = buildReasoningSummary({
      tier: "negotiator",
      riskScore: 52,
      completedText: "I found a 15% coupon for your electronics purchase",
      outcome: "accepted_savings",
    });
    expect(result).toContain("Medium-risk unlock (score: 52)");
    expect(result).toContain("15% coupon");
    expect(result).toContain("User accepted savings");
  });

  it("returns correct therapist summary", () => {
    const result = buildReasoningSummary({
      tier: "therapist",
      riskScore: 78,
      completedText:
        "Let me guide you through a future-self visualization exercise",
      outcome: "wait",
    });
    expect(result).toContain("High-risk unlock (score: 78)");
    expect(result).toContain("future-self visualization");
    expect(result).toContain("User chose to wait");
  });

  it("returns correct degradation summary for analyst_only", () => {
    const result = buildReasoningSummary({
      tier: "negotiator",
      riskScore: 55,
      degraded: { level: "analyst_only", reason: "model timeout" },
    });
    expect(result).toContain("System failure during negotiator intervention");
    expect(result).toContain("score: 55");
    expect(result).toContain("analyst_only");
    expect(result).toContain("model timeout");
  });

  it("returns correct degradation summary for break_glass", () => {
    const result = buildReasoningSummary({
      tier: "therapist",
      riskScore: 90,
      degraded: { level: "break_glass", reason: "API rate limit" },
    });
    expect(result).toContain("System failure");
    expect(result).toContain("break_glass");
    expect(result).toContain("API rate limit");
  });

  it("never includes banned clinical terms in output", () => {
    const bannedTerms = [
      "therapy",
      "therapist",
      "diagnosis",
      "patient",
      "treatment",
      "clinical",
      "session",
    ];

    // Provide completedText that contains banned terms
    const result = buildReasoningSummary({
      tier: "therapist",
      riskScore: 80,
      completedText:
        "This therapy session will help the patient with their diagnosis and treatment plan",
      outcome: "wait",
    });

    for (const term of bannedTerms) {
      const regex = new RegExp(`\\b${term}\\b`, "i");
      expect(regex.test(result)).toBe(false);
    }
  });

  it("truncates long completedText to keep summary under 500 chars", () => {
    const longText = "A".repeat(600);
    const result = buildReasoningSummary({
      tier: "negotiator",
      riskScore: 50,
      completedText: longText,
    });
    expect(result.length).toBeLessThanOrEqual(503); // 500 + "..."
  });

  it("handles missing completedText for negotiator", () => {
    const result = buildReasoningSummary({
      tier: "negotiator",
      riskScore: 45,
      outcome: "accepted",
    });
    expect(result).toContain("Medium-risk unlock (score: 45)");
    expect(result).toContain("User accepted the suggestion");
  });

  it("handles missing completedText for therapist", () => {
    const result = buildReasoningSummary({
      tier: "therapist",
      riskScore: 75,
      outcome: "override",
    });
    expect(result).toContain("High-risk unlock (score: 75)");
    expect(result).toContain("User overrode the suggestion");
  });
});

// ========================================================================
// getGuardianTelemetry metadata enrichment — Story 8.2 (AC#8)
// ========================================================================

describe("getGuardianTelemetry metadata enrichment", () => {
  let getGuardianTelemetry: typeof import("./opik").getGuardianTelemetry;

  beforeEach(async () => {
    mocks.traces = [];
    const mod = await import("./opik");
    getGuardianTelemetry = mod.getGuardianTelemetry;
  });

  it("includes reasoning_summary for auto-approved interactions", () => {
    const result = getGuardianTelemetry(
      "int-100",
      { score: 20, reasoning: "low risk" },
      "analyst",
      true,
      undefined,
      undefined,
      "grocery store"
    );
    expect(result.metadata?.reasoning_summary).toBeDefined();
    expect(result.metadata?.reasoning_summary).toContain("Low-risk unlock");
    expect(result.metadata?.reasoning_summary).toContain("Auto-approved");
  });

  it("includes structured fields: tier, risk_score, purchase_context", () => {
    const result = getGuardianTelemetry(
      "int-101",
      { score: 52, reasoning: "medium risk" },
      "negotiator",
      false,
      undefined,
      undefined,
      "electronics purchase"
    );
    expect(result.metadata?.tier).toBe("negotiator");
    expect(result.metadata?.risk_score).toBe(52);
    expect(result.metadata?.purchase_context).toBe("electronics purchase");
    expect(result.metadata?.interactionId).toBe("int-101");
  });

  it("does not include reasoning_summary for non-auto-approved", () => {
    const result = getGuardianTelemetry(
      "int-102",
      { score: 60, reasoning: "moderate risk" },
      "negotiator",
      false
    );
    expect(result.metadata?.reasoning_summary).toBeUndefined();
  });
});

// ========================================================================
// writeTraceMetadata — Story 8.2
// ========================================================================

describe("writeTraceMetadata", () => {
  let writeTraceMetadata: typeof import("./opik").writeTraceMetadata;

  beforeEach(async () => {
    mocks.traces = [];
    mocks.flush.mockClear();
    mocks.traceEnd.mockClear();
    mocks.searchTraces.mockClear();
    vi.stubEnv("OPIK_API_KEY", "test-key");
    vi.resetModules();
    const mod = await import("./opik");
    writeTraceMetadata = mod.writeTraceMetadata;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("searches traces by metadata.interactionId", async () => {
    mocks.searchTraces.mockResolvedValue([{ id: "trace-001" }]);
    await writeTraceMetadata("int-200", { reasoning_summary: "test" });
    expect(mocks.searchTraces).toHaveBeenCalledWith({
      filterString: 'metadata.interactionId = "int-200"',
      maxResults: 1,
    });
  });

  it("creates metadata trace when parent trace found", async () => {
    mocks.searchTraces.mockResolvedValue([{ id: "trace-001" }]);
    await writeTraceMetadata("int-201", {
      reasoning_summary: "Test summary",
      tier: "negotiator",
    });
    expect(mocks.traces).toHaveLength(1);
    expect(mocks.traces[0].name).toBe("guardian:metadata_update");
    expect(mocks.traces[0].input.interactionId).toBe("int-201");
    expect(mocks.traces[0].input.reasoning_summary).toBe("Test summary");
    expect(mocks.traceEnd).toHaveBeenCalled();
    expect(mocks.flush).toHaveBeenCalled();
  });

  it("does nothing when no parent trace found", async () => {
    mocks.searchTraces.mockResolvedValue([]);
    await writeTraceMetadata("int-202", { reasoning_summary: "test" });
    expect(mocks.traces).toHaveLength(0);
  });

  it("returns early when no Opik client", async () => {
    vi.stubEnv("OPIK_API_KEY", "");
    vi.resetModules();
    const mod = await import("./opik");
    mocks.traces = [];
    await mod.writeTraceMetadata("int-203", { reasoning_summary: "test" });
    expect(mocks.traces).toHaveLength(0);
  });

  it("swallows errors silently", async () => {
    mocks.searchTraces.mockRejectedValue(new Error("network failure"));
    await expect(
      writeTraceMetadata("int-204", { reasoning_summary: "test" })
    ).resolves.toBeUndefined();
  });
});

describe("INTERVENTION_ACCEPTANCE_SCORES", () => {
  let INTERVENTION_ACCEPTANCE_SCORES: typeof import("./opik").INTERVENTION_ACCEPTANCE_SCORES;

  beforeEach(async () => {
    const mod = await import("./opik");
    INTERVENTION_ACCEPTANCE_SCORES = mod.INTERVENTION_ACCEPTANCE_SCORES;
  });

  it("maps accepted to 1.0", () => {
    expect(INTERVENTION_ACCEPTANCE_SCORES.accepted.value).toBe(1.0);
  });

  it("maps accepted_savings to 1.0", () => {
    expect(INTERVENTION_ACCEPTANCE_SCORES.accepted_savings.value).toBe(1.0);
  });

  it("maps wait to 1.0", () => {
    expect(INTERVENTION_ACCEPTANCE_SCORES.wait.value).toBe(1.0);
  });

  it("maps skipped_savings to 0.5", () => {
    expect(INTERVENTION_ACCEPTANCE_SCORES.skipped_savings.value).toBe(0.5);
  });

  it("maps override to 0.0", () => {
    expect(INTERVENTION_ACCEPTANCE_SCORES.override.value).toBe(0.0);
  });

  it("maps wizard_bookmark to 1.0", () => {
    expect(INTERVENTION_ACCEPTANCE_SCORES.wizard_bookmark.value).toBe(1.0);
  });
});

describe("REGRET_FREE_SCORES", () => {
  let REGRET_FREE_SCORES: typeof import("./opik").REGRET_FREE_SCORES;

  beforeEach(async () => {
    const mod = await import("./opik");
    REGRET_FREE_SCORES = mod.REGRET_FREE_SCORES;
  });

  it("maps worth_it to 1.0", () => {
    expect(REGRET_FREE_SCORES.worth_it?.value).toBe(1.0);
  });

  it("maps regret_it to 0.0", () => {
    expect(REGRET_FREE_SCORES.regret_it?.value).toBe(0.0);
  });

  it("maps not_sure to null (no score)", () => {
    expect(REGRET_FREE_SCORES.not_sure).toBeNull();
  });
});

describe("attachFeedbackScoreToTrace", () => {
  let attachFeedbackScoreToTrace: typeof import("./opik").attachFeedbackScoreToTrace;

  beforeEach(async () => {
    mocks.flush.mockClear();
    mocks.searchTraces.mockClear();
    mocks.logTracesFeedbackScores.mockClear();
    mocks.searchTraces.mockResolvedValue([{ id: "trace-123" }]);
    mocks.flush.mockResolvedValue(undefined);
    vi.stubEnv("OPIK_API_KEY", "test-key");
    vi.resetModules();
    const mod = await import("./opik");
    attachFeedbackScoreToTrace = mod.attachFeedbackScoreToTrace;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("searches trace by metadata.interactionId", async () => {
    await attachFeedbackScoreToTrace("int-100", "intervention_acceptance", 1.0);
    expect(mocks.searchTraces).toHaveBeenCalledWith({
      filterString: 'metadata.interactionId = "int-100"',
      maxResults: 1,
    });
  });

  it("calls logTracesFeedbackScores with correct name and value", async () => {
    await attachFeedbackScoreToTrace(
      "int-101",
      "intervention_acceptance",
      0.5,
      "User skipped savings"
    );
    expect(mocks.logTracesFeedbackScores).toHaveBeenCalledWith([
      {
        id: "trace-123",
        name: "intervention_acceptance",
        value: 0.5,
        reason: "User skipped savings",
      },
    ]);
  });

  it("calls flush after scoring", async () => {
    await attachFeedbackScoreToTrace("int-102", "regret_free_spending", 1.0);
    expect(mocks.flush).toHaveBeenCalled();
  });

  it("returns silently when no Opik client (no API key)", async () => {
    vi.stubEnv("OPIK_API_KEY", "");
    vi.resetModules();
    const mod = await import("./opik");
    mocks.searchTraces.mockClear();
    await mod.attachFeedbackScoreToTrace("int-103", "test", 1.0);
    expect(mocks.searchTraces).not.toHaveBeenCalled();
  });

  it("returns silently when trace not found", async () => {
    mocks.searchTraces.mockResolvedValue([]);
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      /* noop */
    });
    await attachFeedbackScoreToTrace("int-104", "test", 1.0);
    expect(mocks.logTracesFeedbackScores).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("catches and logs errors silently", async () => {
    mocks.searchTraces.mockRejectedValue(new Error("network error"));
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      /* noop */
    });
    await expect(
      attachFeedbackScoreToTrace("int-105", "test", 1.0)
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Opik] Failed to attach feedback score"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
