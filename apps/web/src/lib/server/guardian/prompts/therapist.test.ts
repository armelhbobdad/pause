import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { THERAPIST_SYSTEM_PROMPT } from "./therapist";

const BANNED_TERMS = [
  "addiction",
  "compulsive",
  "disorder",
  "therapy",
  "treatment",
  "diagnosis",
  "symptoms",
  "condition",
];

describe("THERAPIST_SYSTEM_PROMPT", () => {
  it("contains strategy selection instructions", () => {
    expect(THERAPIST_SYSTEM_PROMPT).toContain("Reflection Strategy Selection");
    expect(THERAPIST_SYSTEM_PROMPT).toContain("Scan Skillbook");
    expect(THERAPIST_SYSTEM_PROMPT).toContain("helpful - harmful");
  });

  it("references all four strategy types", () => {
    expect(THERAPIST_SYSTEM_PROMPT).toContain("future_self");
    expect(THERAPIST_SYSTEM_PROMPT).toContain("cost_reframe");
    expect(THERAPIST_SYSTEM_PROMPT).toContain("cooling_off");
    expect(THERAPIST_SYSTEM_PROMPT).toContain("values_alignment");
  });

  it("mentions present_reflection and show_wait_option tool names", () => {
    expect(THERAPIST_SYSTEM_PROMPT).toContain("present_reflection");
    expect(THERAPIST_SYSTEM_PROMPT).toContain("show_wait_option");
  });

  it("preserves reconnaissance frame language", () => {
    expect(THERAPIST_SYSTEM_PROMPT).toContain("reconnaissance frame");
    expect(THERAPIST_SYSTEM_PROMPT).toContain("Bodyguard");
  });

  it("does not contain banned terminology in strategy/tool sections", () => {
    // Strategy/tool sections start at "### Reflection Strategy Selection"
    // Banned terms may appear earlier in the prompt (e.g., Tone Examples BAD examples)
    // but must NOT appear in the new Story 5.1 content
    const parts = THERAPIST_SYSTEM_PROMPT.split(
      "### Reflection Strategy Selection"
    );
    expect(parts.length).toBeGreaterThan(1);
    const strategySection = parts[1].toLowerCase();

    for (const term of BANNED_TERMS) {
      expect(strategySection).not.toContain(term);
    }
  });

  it("includes exploration mechanism instruction (~10%)", () => {
    expect(THERAPIST_SYSTEM_PROMPT).toContain("10%");
    expect(THERAPIST_SYSTEM_PROMPT).toContain("explore");
  });

  it("includes default strategy fallback to future_self", () => {
    expect(THERAPIST_SYSTEM_PROMPT).toContain("default to `future_self`");
  });

  it("includes Tool Output Format section", () => {
    expect(THERAPIST_SYSTEM_PROMPT).toContain("Tool Output Format");
  });

  // --- Story 5.2 AC8: prompt minimality after tool call ---
  it("instructs LLM to produce minimal/empty text after calling both tools (AC8)", () => {
    expect(THERAPIST_SYSTEM_PROMPT).toContain(
      "minimal or empty after calling both tools"
    );
  });
});
