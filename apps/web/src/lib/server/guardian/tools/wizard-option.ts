import "server-only";
import { tool } from "ai";
import z from "zod";

export const presentWizardOptionTool = tool({
  description:
    "Offer the user an optional deeper reflection wizard. Call this for high-risk purchases (score 85+) after presenting the initial reflection question via present_reflection. The wizard guides the user through a 3-step CBT-inspired exploration.",
  inputSchema: z.object({
    reasoning: z
      .string()
      .describe(
        "Brief explanation of why deeper exploration might help this user"
      ),
  }),
  execute: ({ reasoning }) => {
    return { wizardAvailable: true, reasoning };
  },
});
