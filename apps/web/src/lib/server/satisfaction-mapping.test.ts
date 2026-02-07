import { describe, expect, it, vi } from "vitest";

// Polarity test regexes (module-level for useTopLevelRegex)
const HARMFUL_PATTERN = /\bincorrect\b|\bharmful\b|\bwrong\b/i;
const HELPFUL_PATTERN = /\bcorrect\b|\bhelpful\b|\bright\b/i;

// --- Mock server-only ---
vi.mock("server-only", () => ({}));

// --- Mock @pause/db (ghost-cards.ts imports it) ---
vi.mock("@pause/db", () => ({
  db: {},
}));

vi.mock("@pause/db/schema", () => ({
  ghostCard: {},
  satisfactionFeedbackEnum: {
    enumValues: ["worth_it", "regret_it", "not_sure"],
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

import {
  satisfactionSignalMap,
  satisfactionToFeedbackSignal,
} from "./ghost-cards";

describe("Satisfaction-to-Signal Mapping", () => {
  // ========================================================================
  // worth_it combinations (AC2)
  // ========================================================================

  describe("worth_it combinations", () => {
    it("worth_it + accepted -> helpful (strategy correctly helped)", () => {
      const signal = satisfactionToFeedbackSignal("worth_it", "accepted");
      expect(signal).toContain("correct");
    });

    it("worth_it + overridden -> harmful (strategy was wrong to intervene)", () => {
      const signal = satisfactionToFeedbackSignal("worth_it", "overridden");
      expect(signal).toContain("incorrect");
    });

    it("worth_it + wait -> helpful (strategy correctly encouraged waiting)", () => {
      const signal = satisfactionToFeedbackSignal("worth_it", "wait");
      expect(signal).toContain("correct");
    });

    it("worth_it + other outcomes -> neutral", () => {
      for (const outcome of [
        "abandoned",
        "timeout",
        "auto_approved",
        "break_glass",
        "wizard_bookmark",
        "wizard_abandoned",
      ]) {
        const signal = satisfactionToFeedbackSignal("worth_it", outcome);
        expect(signal).toContain("neutral");
      }
    });
  });

  // ========================================================================
  // regret_it combinations (AC2)
  // ========================================================================

  describe("regret_it combinations", () => {
    it("regret_it + accepted -> harmful (user regrets following suggestion)", () => {
      const signal = satisfactionToFeedbackSignal("regret_it", "accepted");
      expect(signal).toContain("incorrect");
    });

    it("regret_it + overridden -> helpful (strategy was right, should have been stronger)", () => {
      const signal = satisfactionToFeedbackSignal("regret_it", "overridden");
      expect(signal).toContain("correct");
    });

    it("regret_it + wait -> harmful (user regrets waiting)", () => {
      const signal = satisfactionToFeedbackSignal("regret_it", "wait");
      expect(signal).toContain("incorrect");
    });

    it("regret_it + other outcomes -> neutral", () => {
      for (const outcome of [
        "abandoned",
        "timeout",
        "auto_approved",
        "break_glass",
        "wizard_bookmark",
        "wizard_abandoned",
      ]) {
        const signal = satisfactionToFeedbackSignal("regret_it", outcome);
        expect(signal).toContain("neutral");
      }
    });
  });

  // ========================================================================
  // not_sure combinations (AC2)
  // ========================================================================

  describe("not_sure combinations", () => {
    it("not_sure + any outcome -> neutral", () => {
      for (const outcome of [
        "accepted",
        "overridden",
        "wait",
        "abandoned",
        "timeout",
        "auto_approved",
        "break_glass",
        "wizard_bookmark",
        "wizard_abandoned",
      ]) {
        const signal = satisfactionToFeedbackSignal("not_sure", outcome);
        expect(signal).toContain("neutral");
      }
    });
  });

  // ========================================================================
  // Null/undefined fallback (AC2)
  // ========================================================================

  describe("null/undefined fallback", () => {
    it("returns neutral for null satisfaction", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });
      const signal = satisfactionToFeedbackSignal(
        null as unknown as string,
        "accepted"
      );
      expect(signal).toContain("neutral");
      consoleSpy.mockRestore();
    });

    it("returns neutral for undefined satisfaction", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });
      const signal = satisfactionToFeedbackSignal(
        undefined as unknown as string,
        "accepted"
      );
      expect(signal).toContain("neutral");
      consoleSpy.mockRestore();
    });

    it("returns neutral for unknown outcome", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        /* noop */
      });
      const signal = satisfactionToFeedbackSignal(
        "worth_it",
        "unknown_outcome"
      );
      expect(signal).toContain("neutral");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SatisfactionMapping]")
      );
      consoleSpy.mockRestore();
    });
  });

  // ========================================================================
  // CRITICAL: Signal polarity tests (AC2 — counter-intuitive mappings)
  // ========================================================================

  describe("CRITICAL: signal polarity verification", () => {
    it("worth_it + overridden contains harmful/incorrect keywords (strategy was wrong)", () => {
      const signal = satisfactionToFeedbackSignal("worth_it", "overridden");
      // Strategy tried to block but user is happy they overrode -> strategy was harmful
      expect(signal).toMatch(HARMFUL_PATTERN);
      expect(signal).not.toMatch(HELPFUL_PATTERN);
    });

    it("regret_it + overridden contains helpful/correct keywords (strategy was right)", () => {
      const signal = satisfactionToFeedbackSignal("regret_it", "overridden");
      // User overrode and regrets it -> strategy was correct to try to block
      expect(signal).toMatch(HELPFUL_PATTERN);
      expect(signal).not.toMatch(HARMFUL_PATTERN);
    });
  });

  // ========================================================================
  // Map completeness (AC2 — type-safe coverage)
  // ========================================================================

  describe("map completeness", () => {
    it("satisfactionSignalMap covers all satisfaction x outcome combinations", () => {
      const satisfactions = ["worth_it", "regret_it", "not_sure"] as const;
      const outcomes = [
        "accepted",
        "overridden",
        "abandoned",
        "timeout",
        "auto_approved",
        "break_glass",
        "wait",
        "wizard_bookmark",
        "wizard_abandoned",
      ] as const;

      for (const s of satisfactions) {
        expect(satisfactionSignalMap[s]).toBeDefined();
        for (const o of outcomes) {
          expect(satisfactionSignalMap[s][o]).toBeDefined();
          expect(typeof satisfactionSignalMap[s][o]).toBe("string");
          expect(satisfactionSignalMap[s][o].length).toBeGreaterThan(0);
        }
      }
    });
  });
});
