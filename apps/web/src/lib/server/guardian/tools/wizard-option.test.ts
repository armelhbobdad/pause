import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("ai", () => ({
  tool: vi.fn((def: unknown) => def),
}));

import { presentWizardOptionTool } from "./wizard-option";

const toolDef = presentWizardOptionTool as unknown as {
  description: string;
  inputSchema: { parse: (v: unknown) => unknown };
  execute: (input: { reasoning: string }) => {
    wizardAvailable: boolean;
    reasoning: string;
  };
};

describe("presentWizardOptionTool", () => {
  it("returns { wizardAvailable: true, reasoning } for any input", () => {
    const result = toolDef.execute({
      reasoning:
        "This is a significant purchase. Taking a few minutes to explore what's driving this desire could help.",
    });

    expect(result).toEqual({
      wizardAvailable: true,
      reasoning:
        "This is a significant purchase. Taking a few minutes to explore what's driving this desire could help.",
    });
  });

  it("always returns wizardAvailable as true", () => {
    const result = toolDef.execute({
      reasoning: "Different reasoning text",
    });

    expect(result.wizardAvailable).toBe(true);
  });

  it("passes through reasoning unchanged", () => {
    const reasoning =
      "Exploring your feelings might help you make a better decision.";
    const result = toolDef.execute({ reasoning });

    expect(result.reasoning).toBe(reasoning);
  });

  it("has a description instructing the LLM when to call it", () => {
    expect(toolDef.description).toBeTruthy();
    expect(toolDef.description).toContain("wizard");
  });

  it("has an input schema defined", () => {
    expect(toolDef.inputSchema).toBeDefined();
  });
});
