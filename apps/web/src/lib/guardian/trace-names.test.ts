import { describe, expect, it } from "vitest";
import type { TraceName } from "./trace-names";
import { TRACE_NAMES } from "./trace-names";

const COLON_PREFIX_PATTERN = /^(guardian|system|learning|chat):/;

describe("trace-names", () => {
  it("TRACE_NAMES has all 16 entries", () => {
    expect(Object.keys(TRACE_NAMES)).toHaveLength(16);
  });

  it("all TRACE_NAMES values are valid TraceName strings", () => {
    const expectedValues: TraceName[] = [
      "guardian:analyst:auto_approved",
      "guardian:negotiator:accepted_savings",
      "guardian:negotiator:skipped_savings",
      "guardian:negotiator:accepted",
      "guardian:negotiator:override",
      "guardian:therapist:wait",
      "guardian:therapist:accepted",
      "guardian:therapist:override",
      "guardian:therapist:wizard_bookmark",
      "guardian:therapist:wizard_abandoned",
      "guardian:break_glass",
      "system:failure:analyst_only",
      "system:failure:break_glass",
      "learning:reflection",
      "learning:skillbook_update",
      "chat:knowledge",
    ];
    const values = Object.values(TRACE_NAMES);
    for (const expected of expectedValues) {
      expect(values).toContain(expected);
    }
  });

  it("has no duplicate values", () => {
    const values = Object.values(TRACE_NAMES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("all guardian traces use colon-separated prefix format", () => {
    for (const value of Object.values(TRACE_NAMES)) {
      expect(value).toMatch(COLON_PREFIX_PATTERN);
    }
  });
});
