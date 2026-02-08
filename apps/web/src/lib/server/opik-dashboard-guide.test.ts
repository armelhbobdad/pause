import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const OQL_OPERATOR_PATTERN = /^name (starts_with|ends_with) ".+"$/;

describe("opik-dashboard-guide", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe("DASHBOARD_CONFIG", () => {
    it("has correct default project name and workspace", async () => {
      const { DASHBOARD_CONFIG } = await import("./opik-dashboard-guide");
      expect(DASHBOARD_CONFIG.projectName).toBe("pause");
      expect(DASHBOARD_CONFIG.workspaceName).toBe("default");
      expect(DASHBOARD_CONFIG.baseUrl).toBe("https://www.comet.com/opik");
    });

    it("has correct tags for hackathon filtering", async () => {
      const { DASHBOARD_CONFIG } = await import("./opik-dashboard-guide");
      expect(DASHBOARD_CONFIG.tags).toEqual(["hackathon", "pause"]);
      expect(DASHBOARD_CONFIG.tags).toHaveLength(2);
    });
  });

  describe("getDashboardUrl", () => {
    it("returns correct URL format with default config", async () => {
      const { getDashboardUrl } = await import("./opik-dashboard-guide");
      const url = getDashboardUrl();
      expect(url).toBe("https://www.comet.com/opik/default/pause/traces");
    });

    it("uses env var overrides for project and workspace", async () => {
      vi.stubEnv("OPIK_PROJECT_NAME", "custom-project");
      vi.stubEnv("OPIK_WORKSPACE", "my-workspace");
      vi.resetModules();
      const { getDashboardUrl } = await import("./opik-dashboard-guide");
      const url = getDashboardUrl();
      expect(url).toBe(
        "https://www.comet.com/opik/my-workspace/custom-project/traces"
      );
    });
  });

  describe("getFilteredUrl", () => {
    it("appends URI-encoded filter parameter to dashboard URL", async () => {
      const { getFilteredUrl } = await import("./opik-dashboard-guide");
      const url = getFilteredUrl('name starts_with "guardian:therapist:"');
      expect(url).toContain(
        "https://www.comet.com/opik/default/pause/traces?filters="
      );
      expect(url).toContain(encodeURIComponent("guardian:therapist:"));
    });
  });

  describe("FILTER_PATTERNS", () => {
    it("has entries for all 6 filter categories", async () => {
      const { FILTER_PATTERNS } = await import("./opik-dashboard-guide");
      const keys = Object.keys(FILTER_PATTERNS);
      expect(keys).toHaveLength(6);
      expect(keys).toEqual(
        expect.arrayContaining([
          "ANALYST_ONLY",
          "NEGOTIATOR_ONLY",
          "THERAPIST_ONLY",
          "OVERRIDES_ONLY",
          "LEARNING_ONLY",
          "SYSTEM_FAILURES",
        ])
      );
    });

    it("values are valid OQL-like filter strings", async () => {
      const { FILTER_PATTERNS } = await import("./opik-dashboard-guide");
      for (const value of Object.values(FILTER_PATTERNS)) {
        expect(value).toMatch(OQL_OPERATOR_PATTERN);
      }
    });
  });

  describe("METRIC_DEFINITIONS", () => {
    it("has entries for all 4 core metrics", async () => {
      const { METRIC_DEFINITIONS } = await import("./opik-dashboard-guide");
      const keys = Object.keys(METRIC_DEFINITIONS);
      expect(keys).toHaveLength(4);
      expect(keys).toEqual(
        expect.arrayContaining([
          "acceptance_rate",
          "regret_free_rate",
          "total_traces",
          "override_rate",
        ])
      );
    });
  });

  // ========================================================================
  // Story 8.5b: Learning Sequence and Filter Patterns
  // ========================================================================

  describe("LEARNING_SEQUENCE (Story 8.5b)", () => {
    it("has required documentation fields for learning cycle tracing", async () => {
      const { LEARNING_SEQUENCE } = await import("./opik-dashboard-guide");
      expect(LEARNING_SEQUENCE.description).toBeDefined();
      expect(LEARNING_SEQUENCE.steps).toBeInstanceOf(Array);
      expect(LEARNING_SEQUENCE.steps.length).toBeGreaterThanOrEqual(4);
      expect(LEARNING_SEQUENCE.filterPattern).toContain("interactionId");
      expect(LEARNING_SEQUENCE.timeToExplain).toBe("<60 seconds");
    });
  });

  describe("LEARNING_FILTER_PATTERNS (Story 8.5b)", () => {
    it("has entries for all 5 filter types", async () => {
      const { LEARNING_FILTER_PATTERNS } = await import(
        "./opik-dashboard-guide"
      );
      const keys = Object.keys(LEARNING_FILTER_PATTERNS);
      expect(keys).toHaveLength(5);
      expect(keys).toEqual(
        expect.arrayContaining([
          "ALL_LEARNING",
          "REFLECTIONS_ONLY",
          "SKILLBOOK_UPDATES_ONLY",
          "SATISFACTION_ONLY",
          "BY_INTERACTION",
        ])
      );
    });

    it("BY_INTERACTION generates correct OQL filter with interpolated id", async () => {
      const { LEARNING_FILTER_PATTERNS } = await import(
        "./opik-dashboard-guide"
      );
      const filter = LEARNING_FILTER_PATTERNS.BY_INTERACTION("int-test-123");
      expect(filter).toBe('metadata.interactionId = "int-test-123"');
    });

    it("static filter patterns are valid OQL-like strings", async () => {
      const { LEARNING_FILTER_PATTERNS } = await import(
        "./opik-dashboard-guide"
      );
      expect(LEARNING_FILTER_PATTERNS.ALL_LEARNING).toContain("learning:");
      expect(LEARNING_FILTER_PATTERNS.REFLECTIONS_ONLY).toContain(
        "learning:reflection"
      );
      expect(LEARNING_FILTER_PATTERNS.SKILLBOOK_UPDATES_ONLY).toContain(
        "learning:skillbook_update"
      );
      expect(LEARNING_FILTER_PATTERNS.SATISFACTION_ONLY).toContain(
        "learning:satisfaction_feedback"
      );
    });
  });
});
