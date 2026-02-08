import { Skillbook } from "@pause/ace";
import { describe, expect, it, vi } from "vitest";
import {
  type PredictedStrategy,
  predictNextStrategy,
} from "@/lib/server/strategy-prediction";

vi.mock("server-only", () => ({}));

describe("predictNextStrategy", () => {
  describe("analyst tier", () => {
    it("returns auto_approve with confidence 1.0", () => {
      const result = predictNextStrategy({
        tier: "analyst",
        skillbook: null,
      });

      expect(result).toEqual({
        strategy_id: "auto_approve",
        confidence: 1.0,
        alternatives: [],
      });
    });

    it("ignores Skillbook state for analyst tier", () => {
      const sb = new Skillbook();
      sb.addSkill("future_self", "test content");

      const result = predictNextStrategy({
        tier: "analyst",
        skillbook: sb,
      });

      expect(result.strategy_id).toBe("auto_approve");
      expect(result.confidence).toBe(1.0);
    });
  });

  describe("negotiator tier", () => {
    it("returns coupon_search with confidence 0.9", () => {
      const result = predictNextStrategy({
        tier: "negotiator",
        skillbook: null,
      });

      expect(result).toEqual({
        strategy_id: "coupon_search",
        confidence: 0.9,
        alternatives: [{ strategy_id: "price_comparison", confidence: 0.1 }],
      });
    });
  });

  describe("therapist tier with skills", () => {
    it("returns top skill as strategy_id", () => {
      const sb = new Skillbook();
      const skill1 = sb.addSkill("future_self", "visualization strategy");
      sb.tagSkill(skill1.id, "helpful", 8);
      sb.tagSkill(skill1.id, "harmful", 1);
      sb.tagSkill(skill1.id, "neutral", 1);

      const skill2 = sb.addSkill("cost_analysis", "cost per use");
      sb.tagSkill(skill2.id, "helpful", 3);
      sb.tagSkill(skill2.id, "harmful", 2);
      sb.tagSkill(skill2.id, "neutral", 5);

      const result = predictNextStrategy({
        tier: "therapist",
        skillbook: sb,
      });

      expect(result.strategy_id).toBe("future_self");
      // (8 - 1) / max(8 + 1 + 1, 1) = 7 / 10 = 0.7
      expect(result.confidence).toBeCloseTo(0.7);
    });

    it("returns alternatives containing top 3 non-primary skills", () => {
      const sb = new Skillbook();
      const s1 = sb.addSkill("strategy_a", "a");
      sb.tagSkill(s1.id, "helpful", 10);

      const s2 = sb.addSkill("strategy_b", "b");
      sb.tagSkill(s2.id, "helpful", 8);

      const s3 = sb.addSkill("strategy_c", "c");
      sb.tagSkill(s3.id, "helpful", 5);

      const s4 = sb.addSkill("strategy_d", "d");
      sb.tagSkill(s4.id, "helpful", 3);

      const s5 = sb.addSkill("strategy_e", "e");
      sb.tagSkill(s5.id, "helpful", 1);

      const result = predictNextStrategy({
        tier: "therapist",
        skillbook: sb,
      });

      expect(result.strategy_id).toBe("strategy_a");
      expect(result.alternatives).toHaveLength(3);
      expect(result.alternatives[0].strategy_id).toBe("strategy_b");
      expect(result.alternatives[1].strategy_id).toBe("strategy_c");
      expect(result.alternatives[2].strategy_id).toBe("strategy_d");
    });

    it("confidence is clamped to [0, 1]", () => {
      const sb = new Skillbook();
      // All harmful: (0 - 5) / 5 = -1.0 -> clamped to 0
      const s1 = sb.addSkill("bad_strategy", "harmful content");
      sb.tagSkill(s1.id, "harmful", 5);

      const result = predictNextStrategy({
        tier: "therapist",
        skillbook: sb,
      });

      expect(result.confidence).toBe(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("handles all-harmful skills with confidence near 0", () => {
      const sb = new Skillbook();
      const s1 = sb.addSkill("harmful_a", "content a");
      sb.tagSkill(s1.id, "harmful", 10);

      const s2 = sb.addSkill("harmful_b", "content b");
      sb.tagSkill(s2.id, "harmful", 5);
      sb.tagSkill(s2.id, "helpful", 1);

      const result = predictNextStrategy({
        tier: "therapist",
        skillbook: sb,
      });

      // harmful_b: (1-5)/6 = -0.667 -> 0; harmful_a: (0-10)/10 = -1 -> 0
      // Both clamped to 0
      expect(result.confidence).toBe(0);
      for (const alt of result.alternatives) {
        expect(alt.confidence).toBeGreaterThanOrEqual(0);
      }
    });

    it("handles single-skill Skillbook", () => {
      const sb = new Skillbook();
      const s1 = sb.addSkill("solo_strategy", "only strategy");
      sb.tagSkill(s1.id, "helpful", 4);
      sb.tagSkill(s1.id, "neutral", 1);

      const result = predictNextStrategy({
        tier: "therapist",
        skillbook: sb,
      });

      expect(result.strategy_id).toBe("solo_strategy");
      // (4 - 0) / max(4 + 0 + 1, 1) = 4/5 = 0.8
      expect(result.confidence).toBeCloseTo(0.8);
      expect(result.alternatives).toEqual([]);
    });
  });

  describe("therapist tier with empty Skillbook", () => {
    it("returns default strategy with confidence 0.5", () => {
      const result = predictNextStrategy({
        tier: "therapist",
        skillbook: new Skillbook(),
      });

      expect(result).toEqual({
        strategy_id: "default",
        confidence: 0.5,
        alternatives: [],
      });
    });

    it("returns default for null Skillbook", () => {
      const result = predictNextStrategy({
        tier: "therapist",
        skillbook: null,
      });

      expect(result).toEqual({
        strategy_id: "default",
        confidence: 0.5,
        alternatives: [],
      });
    });
  });

  describe("PredictedStrategy shape", () => {
    it("matches expected interface for all tiers", () => {
      const tiers = ["analyst", "negotiator", "therapist"] as const;

      for (const tier of tiers) {
        const result: PredictedStrategy = predictNextStrategy({
          tier,
          skillbook: null,
        });

        expect(result).toHaveProperty("strategy_id");
        expect(result).toHaveProperty("confidence");
        expect(result).toHaveProperty("alternatives");
        expect(typeof result.strategy_id).toBe("string");
        expect(typeof result.confidence).toBe("number");
        expect(Array.isArray(result.alternatives)).toBe(true);

        for (const alt of result.alternatives) {
          expect(typeof alt.strategy_id).toBe("string");
          expect(typeof alt.confidence).toBe("number");
        }
      }
    });
  });

  describe("deterministic behavior", () => {
    it("produces identical output for the same Skillbook state", () => {
      const sb = new Skillbook();
      const s1 = sb.addSkill("future_self", "visualization");
      sb.tagSkill(s1.id, "helpful", 5);
      const s2 = sb.addSkill("cost_analysis", "cost per use");
      sb.tagSkill(s2.id, "helpful", 3);

      const result1 = predictNextStrategy({
        tier: "therapist",
        skillbook: sb,
      });
      const result2 = predictNextStrategy({
        tier: "therapist",
        skillbook: sb,
      });

      expect(result1).toEqual(result2);
    });
  });

  describe("confidence calculation", () => {
    it("computes ratio as (helpful - harmful) / total", () => {
      const sb = new Skillbook();
      const skill = sb.addSkill("test_section", "test content");
      sb.tagSkill(skill.id, "helpful", 7);
      sb.tagSkill(skill.id, "harmful", 2);
      sb.tagSkill(skill.id, "neutral", 1);

      const result = predictNextStrategy({
        tier: "therapist",
        skillbook: sb,
      });

      // (7 - 2) / max(7 + 2 + 1, 1) = 5 / 10 = 0.5
      expect(result.confidence).toBeCloseTo(0.5);
    });

    it("clamps alternatives confidence to [0, 1]", () => {
      const sb = new Skillbook();
      const s1 = sb.addSkill("good_strategy", "good");
      sb.tagSkill(s1.id, "helpful", 10);

      const s2 = sb.addSkill("bad_strategy", "bad");
      sb.tagSkill(s2.id, "harmful", 10);

      const result = predictNextStrategy({
        tier: "therapist",
        skillbook: sb,
      });

      expect(result.strategy_id).toBe("good_strategy");
      expect(result.confidence).toBe(1.0);
      expect(result.alternatives).toHaveLength(1);
      expect(result.alternatives[0].confidence).toBe(0);
    });
  });
});
