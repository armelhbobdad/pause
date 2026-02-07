import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("ai", () => ({
  tool: vi.fn((def: unknown) => def),
}));

import { showWaitOptionTool } from "./wait-option";

const toolDef = showWaitOptionTool as unknown as {
  description: string;
  inputSchema: { parse: (v: unknown) => unknown };
  execute: (input: { reasoning: string }) => Promise<{
    durationHours: number;
    reasoning: string;
  }>;
};

describe("showWaitOptionTool", () => {
  it("returns { durationHours: 24, reasoning } for any input", async () => {
    const result = await toolDef.execute({
      reasoning: "Sleeping on it often brings clarity",
    });

    expect(result).toEqual({
      durationHours: 24,
      reasoning: "Sleeping on it often brings clarity",
    });
  });

  it("always returns durationHours as 24", async () => {
    const result = await toolDef.execute({
      reasoning: "Different reasoning text",
    });

    expect(result.durationHours).toBe(24);
  });

  it("has a description instructing the LLM when to call it", () => {
    expect(toolDef.description).toBeTruthy();
    expect(toolDef.description).toContain("wait");
  });

  it("has an input schema defined", () => {
    expect(toolDef.inputSchema).toBeDefined();
  });
});
