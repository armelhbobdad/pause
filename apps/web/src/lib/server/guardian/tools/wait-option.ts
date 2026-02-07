import "server-only";
import { tool } from "ai";
import z from "zod";

export const showWaitOptionTool = tool({
  description:
    "Offer the user a 24-hour wait period after presenting a reflection. Call this tool after presenting the reflection question to give the user the option to sleep on their purchase decision.",
  inputSchema: z.object({
    reasoning: z
      .string()
      .describe("Brief explanation of why waiting might help"),
  }),
  execute: ({ reasoning }) => {
    return { durationHours: 24, reasoning };
  },
});
