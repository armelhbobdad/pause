import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { determineTier } from "./tiers";

describe("determineTier", () => {
  it("returns analyst for score 0 (minimum)", () => {
    expect(determineTier(0)).toBe("analyst");
  });

  it("returns analyst for score 29 (upper boundary)", () => {
    expect(determineTier(29)).toBe("analyst");
  });

  it("returns negotiator for score 30 (lower boundary)", () => {
    expect(determineTier(30)).toBe("negotiator");
  });

  it("returns negotiator for score 69 (upper boundary)", () => {
    expect(determineTier(69)).toBe("negotiator");
  });

  it("returns therapist for score 70 (lower boundary)", () => {
    expect(determineTier(70)).toBe("therapist");
  });

  it("returns therapist for score 100 (maximum)", () => {
    expect(determineTier(100)).toBe("therapist");
  });
});
