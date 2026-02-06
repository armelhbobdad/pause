import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { InteractionTier } from "./tiers";
import { determineTier } from "./tiers";

describe("determineTier", () => {
  it.each([
    [0, "analyst"],
    [15, "analyst"],
    [29, "analyst"],
    [30, "negotiator"],
    [50, "negotiator"],
    [69, "negotiator"],
    [70, "therapist"],
    [85, "therapist"],
    [100, "therapist"],
  ] as const)("score %d → %s", (score, expected) => {
    expect(determineTier(score)).toBe(expected);
  });

  // Edge case: negative score defense
  it("returns analyst for negative score (-5)", () => {
    expect(determineTier(-5)).toBe("analyst");
  });

  // Edge case: score > 100 defense
  it("returns therapist for score > 100 (110)", () => {
    expect(determineTier(110)).toBe("therapist");
  });

  // Type check: ensures return type matches InteractionTier
  it("returns a valid InteractionTier value", () => {
    const validTiers: InteractionTier[] = [
      "analyst",
      "negotiator",
      "therapist",
    ];
    expect(validTiers).toContain(determineTier(0));
    expect(validTiers).toContain(determineTier(50));
    expect(validTiers).toContain(determineTier(100));
  });
});
