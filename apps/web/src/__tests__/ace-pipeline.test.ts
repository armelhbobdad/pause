/**
 * ACE Reflector → SkillManager → Skillbook Integration Test
 *
 * Verifies the vendored ACE pipeline actually runs end-to-end:
 * 1. Reflector analyzes agent output and extracts learnings
 * 2. SkillManager converts reflection into skillbook operations
 * 3. Skillbook.applyUpdate() mutates state correctly
 *
 * Uses DummyLLMClient with queued JSON responses — no real LLM calls.
 * Closes the P1 spike gap from Epic 5 retro (runtime verification).
 */

import { DummyLLMClient, Reflector, Skillbook, SkillManager } from "@pause/ace";
import { describe, expect, it } from "vitest";

describe("ACE Reflector → SkillManager → Skillbook pipeline", () => {
  it("processes reflection and applies skill updates end-to-end", async () => {
    // -- Arrange: Skillbook with one seed skill --
    const skillbook = new Skillbook();
    const seedSkill = skillbook.addSkill(
      "impulse-control",
      "When feeling the urge to buy, pause and count to 10 before deciding."
    );
    expect(skillbook.skills()).toHaveLength(1);

    // -- Arrange: DummyLLMClient with queued responses --
    // Response 1: Reflector's completeStructured() — must match ReflectorOutputSchema
    const reflectorResponse = JSON.stringify({
      analysis:
        "The agent correctly identified an impulse purchase pattern. The pause-and-count strategy was effective.",
      helpful_skill_ids: [seedSkill.id],
      harmful_skill_ids: [],
      new_learnings: [
        {
          section: "price-comparison",
          content:
            "Before any purchase over $20, check at least two alternative sources for better pricing.",
          atomicity_score: 0.9,
        },
      ],
      reflection_quality: {
        root_cause_identified: true,
        learnings_actionable: true,
        evidence_based: true,
      },
    });

    // Response 2: SkillManager's complete() — UpdateBatch JSON
    const skillManagerResponse = JSON.stringify({
      reasoning:
        "Adding a new price-comparison skill and tagging the existing impulse-control skill as helpful.",
      operations: [
        {
          type: "ADD",
          section: "price-comparison",
          content:
            "Before any purchase over $20, check at least two alternative sources for better pricing.",
        },
        {
          type: "TAG",
          section: "impulse-control",
          skill_id: seedSkill.id,
          metadata: { helpful: 1 },
        },
      ],
    });

    const llm = new DummyLLMClient([reflectorResponse, skillManagerResponse]);

    // -- Act: Run the pipeline --

    // Step 1: Reflector analyzes
    const reflector = new Reflector(llm);
    const reflection = await reflector.reflect({
      question: "Should I buy these shoes on sale for $80?",
      generatorAnswer:
        "Let me pause and think about this. The shoes are 40% off, but you already have similar ones. Wait 24 hours before deciding.",
      feedback: "correct — the user avoided an impulse purchase",
      skillbook,
    });

    // Step 2: SkillManager curates updates
    const skillManager = new SkillManager(llm);
    const updateBatch = await skillManager.curate({
      reflectionAnalysis: reflection.analysis,
      skillbook,
    });

    // Step 3: Skillbook applies updates
    skillbook.applyUpdate(updateBatch);

    // -- Assert: Reflection output --
    expect(reflection.analysis).toContain("impulse purchase");
    expect(reflection.helpful_skill_ids).toContain(seedSkill.id);
    expect(reflection.harmful_skill_ids).toHaveLength(0);
    expect(reflection.new_learnings).toHaveLength(1);
    expect(reflection.new_learnings[0].section).toBe("price-comparison");
    expect(reflection.new_learnings[0].atomicity_score).toBe(0.9);
    expect(reflection.reflection_quality).toEqual({
      root_cause_identified: true,
      learnings_actionable: true,
      evidence_based: true,
    });

    // -- Assert: UpdateBatch structure --
    expect(updateBatch.reasoning).toContain("price-comparison");
    expect(updateBatch.operations).toHaveLength(2);
    expect(updateBatch.operations[0].type).toBe("ADD");
    expect(updateBatch.operations[1].type).toBe("TAG");

    // -- Assert: Skillbook mutated correctly --
    const allSkills = skillbook.skills();
    expect(allSkills).toHaveLength(2);

    // Seed skill was tagged as helpful
    const taggedSeed = skillbook.getSkill(seedSkill.id);
    expect(taggedSeed).not.toBeNull();
    expect(taggedSeed?.helpful).toBe(1);

    // New skill was added
    const newSkill = allSkills.find((s) => s.section === "price-comparison");
    expect(newSkill).toBeDefined();
    expect(newSkill?.content).toContain("two alternative sources");
  });

  it("handles empty reflection (no learnings, no updates)", async () => {
    const skillbook = new Skillbook();
    skillbook.addSkill("budgeting", "Track all expenses weekly.");

    const reflectorResponse = JSON.stringify({
      analysis:
        "The agent response was adequate. No specific improvements identified.",
      helpful_skill_ids: [],
      harmful_skill_ids: [],
      new_learnings: [],
    });

    const skillManagerResponse = JSON.stringify({
      reasoning:
        "No updates needed — reflection found no actionable improvements.",
      operations: [],
    });

    const llm = new DummyLLMClient([reflectorResponse, skillManagerResponse]);

    const reflector = new Reflector(llm);
    const reflection = await reflector.reflect({
      question: "How should I track my spending?",
      generatorAnswer:
        "Use a weekly expense tracker and categorize each purchase.",
      feedback: "correct",
      skillbook,
    });

    const skillManager = new SkillManager(llm);
    const updateBatch = await skillManager.curate({
      reflectionAnalysis: reflection.analysis,
      skillbook,
    });

    skillbook.applyUpdate(updateBatch);

    // Skillbook unchanged
    expect(skillbook.skills()).toHaveLength(1);
    expect(updateBatch.operations).toHaveLength(0);
  });

  it("handles harmful skill tagging and removal", async () => {
    const skillbook = new Skillbook();
    const badSkill = skillbook.addSkill(
      "shopping-heuristic",
      "If it is on sale, always buy it immediately."
    );

    const reflectorResponse = JSON.stringify({
      analysis:
        "The 'always buy on sale' heuristic led to an impulsive purchase. This skill is harmful.",
      helpful_skill_ids: [],
      harmful_skill_ids: [badSkill.id],
      new_learnings: [],
    });

    const skillManagerResponse = JSON.stringify({
      reasoning:
        "Removing the harmful shopping heuristic that encourages impulse buying.",
      operations: [
        {
          type: "TAG",
          section: "shopping-heuristic",
          skill_id: badSkill.id,
          metadata: { harmful: 1 },
        },
        {
          type: "REMOVE",
          section: "shopping-heuristic",
          skill_id: badSkill.id,
        },
      ],
    });

    const llm = new DummyLLMClient([reflectorResponse, skillManagerResponse]);

    const reflector = new Reflector(llm);
    const reflection = await reflector.reflect({
      question: "These headphones are 50% off, should I buy them?",
      generatorAnswer: "Yes, buy them immediately — great deal!",
      feedback:
        "incorrect — user already has working headphones, this was impulse buying",
      skillbook,
    });

    const skillManager = new SkillManager(llm);
    const updateBatch = await skillManager.curate({
      reflectionAnalysis: reflection.analysis,
      skillbook,
    });

    skillbook.applyUpdate(updateBatch);

    expect(reflection.harmful_skill_ids).toContain(badSkill.id);
    expect(updateBatch.operations).toHaveLength(2);
    // Skill was removed
    expect(skillbook.skills()).toHaveLength(0);
    expect(skillbook.getSkill(badSkill.id)).toBeNull();
  });

  it("serialization roundtrip preserves skillbook after pipeline mutations", async () => {
    const skillbook = new Skillbook();
    skillbook.addSkill("savings", "Set aside 20% of income before spending.");

    const reflectorResponse = JSON.stringify({
      analysis:
        "Good savings advice. Adding a complementary emergency fund skill.",
      helpful_skill_ids: [],
      harmful_skill_ids: [],
      new_learnings: [
        {
          section: "emergency-fund",
          content:
            "Maintain 3-6 months of expenses in a liquid emergency fund.",
          atomicity_score: 0.85,
        },
      ],
    });

    const skillManagerResponse = JSON.stringify({
      reasoning: "Adding emergency fund skill from reflection.",
      operations: [
        {
          type: "ADD",
          section: "emergency-fund",
          content:
            "Maintain 3-6 months of expenses in a liquid emergency fund.",
        },
      ],
    });

    const llm = new DummyLLMClient([reflectorResponse, skillManagerResponse]);

    const reflector = new Reflector(llm);
    const reflection = await reflector.reflect({
      question: "How much should I save?",
      generatorAnswer: "Save 20% of your income.",
      feedback:
        "partially correct — good rule but missing emergency fund advice",
      skillbook,
    });

    const skillManager = new SkillManager(llm);
    const updateBatch = await skillManager.curate({
      reflectionAnalysis: reflection.analysis,
      skillbook,
    });

    skillbook.applyUpdate(updateBatch);
    expect(skillbook.skills()).toHaveLength(2);

    // Roundtrip via JSON serialization
    const serialized = skillbook.dumps();
    const restored = Skillbook.loads(serialized);

    expect(restored.skills()).toHaveLength(2);
    expect(
      restored
        .skills()
        .map((s) => s.section)
        .sort()
    ).toEqual(["emergency-fund", "savings"]);

    // asPrompt() should include both skills
    const prompt = restored.asPrompt();
    expect(prompt).toContain("20% of income");
    expect(prompt).toContain("emergency fund");
  });
});
