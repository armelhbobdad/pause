import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("ai", () => ({
  tool: vi.fn((def: unknown) => def),
}));

import { presentReflectionTool } from "./reflection-prompt";

const toolDef = presentReflectionTool as unknown as {
  description: string;
  inputSchema: { parse: (v: unknown) => unknown };
  execute: (input: {
    strategyId: string;
    reflectionPrompt: string;
    strategyName: string;
  }) => Promise<{
    strategyId: string;
    reflectionPrompt: string;
    strategyName: string;
  }>;
};

describe("presentReflectionTool", () => {
  it("returns pass-through output with strategyId, reflectionPrompt, strategyName", async () => {
    const result = await toolDef.execute({
      strategyId: "future_self",
      reflectionPrompt: "What would tomorrow-you think about this?",
      strategyName: "Future-Self Visualization",
    });

    expect(result).toEqual({
      strategyId: "future_self",
      reflectionPrompt: "What would tomorrow-you think about this?",
      strategyName: "Future-Self Visualization",
    });
  });

  it("has a description instructing the LLM when to call it", () => {
    expect(toolDef.description).toBeTruthy();
    expect(toolDef.description).toContain("reflection");
  });

  it("has an input schema defined", () => {
    expect(toolDef.inputSchema).toBeDefined();
  });
});
