import "server-only";
import { tool } from "ai";
import z from "zod";

export const presentReflectionTool = tool({
  description:
    "Present a reflective question to the user based on the selected reflection strategy. Call this tool with the crafted reflection question after analyzing the Skillbook for strategy effectiveness. The question should be adapted to the purchase context using the selected strategy's approach.",
  inputSchema: z.object({
    strategyId: z
      .string()
      .describe(
        "Strategy identifier, e.g. 'future_self' or Skillbook skill ID"
      ),
    reflectionPrompt: z
      .string()
      .describe("The crafted reflection question for the user"),
    strategyName: z
      .string()
      .describe("Human-readable strategy name for display"),
  }),
  execute: ({ strategyId, reflectionPrompt, strategyName }) => {
    return { strategyId, reflectionPrompt, strategyName };
  },
});
