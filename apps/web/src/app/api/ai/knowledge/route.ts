import { google } from "@ai-sdk/google";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { getGuardianTelemetry } from "@/lib/server/opik";

export const runtime = "nodejs";
export const maxDuration = 30;

const KNOWLEDGE_SYSTEM_PROMPT = `You are Pause, a friendly AI assistant that helps people make thoughtful spending decisions.

Your role in this chat:
- Answer questions about how Pause works, spending patterns, and mindful purchasing
- Provide general information about impulse spending and behavioral finance concepts
- Redirect users to the Guardian flow when they want to evaluate a specific purchase

Important guardrails:
- Never provide specific financial advice (e.g., "you should buy X" or "invest in Y")
- If asked about specific financial planning, respond with: "I'm best at spending patterns. For financial planning, consider a professional."
- Keep responses concise and conversational
- Use clear, non-financial-advice language
- If someone wants to start evaluating a purchase, suggest: "You can tap the Card Vault on your dashboard to start a Guardian session."

You are NOT a financial advisor. You are a spending awareness companion.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: KNOWLEDGE_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    experimental_telemetry: getGuardianTelemetry(
      crypto.randomUUID(),
      undefined,
      "knowledge",
      false
    ),
    abortSignal: AbortSignal.timeout(10_000),
  });

  return result.toUIMessageStreamResponse();
}
