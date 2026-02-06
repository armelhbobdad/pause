import { google } from "@ai-sdk/google";
import { auth } from "@pause/auth";
import { db } from "@pause/db";
import { card, interaction } from "@pause/db/schema";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import z from "zod";
import { wrapSkillbookContext } from "@/lib/server/ace";
import { ANALYST_SYSTEM_PROMPT } from "@/lib/server/guardian/prompts/analyst";
import { NEGOTIATOR_SYSTEM_PROMPT } from "@/lib/server/guardian/prompts/negotiator";
import { THERAPIST_SYSTEM_PROMPT } from "@/lib/server/guardian/prompts/therapist";
import { assessRisk } from "@/lib/server/guardian/risk";
import {
  determineTier,
  type InteractionTier,
} from "@/lib/server/guardian/tiers";
import { getGuardianTelemetry } from "@/lib/server/opik";
import { withTimeout } from "@/lib/server/utils";

const TIER_PROMPTS: Record<InteractionTier, string> = {
  analyst: ANALYST_SYSTEM_PROMPT,
  negotiator: NEGOTIATOR_SYSTEM_PROMPT,
  therapist: THERAPIST_SYSTEM_PROMPT,
};

export const runtime = "nodejs";
export const maxDuration = 30;

const DB_TIMEOUT_MS = 10_000;

const requestSchema = z.object({
  messages: z
    .array(
      z
        .object({ role: z.enum(["user", "assistant", "system", "tool"]) })
        .passthrough()
    )
    .min(1),
  cardId: z.string().min(1),
  purchaseContext: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  // Service health tracking — scaffold for Story 3.6 degradation ladder.
  // Flags are set in catch blocks; Story 3.6 will read them for tier fallback.
  const serviceHealth = { gemini: true, opik: true, neon: true, ace: true };

  // --- Auth check (AC#2) ---
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // --- Request validation (AC#1) ---
  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("Invalid request body", { status: 400 });
  }
  const { messages, cardId, purchaseContext } = parsed.data;

  // --- Authorization: verify card ownership (AC#3) ---
  let userCard: { id: string; userId: string } | undefined;
  try {
    const result = await withTimeout(
      db
        .select({ id: card.id, userId: card.userId })
        .from(card)
        .where(and(eq(card.id, cardId), eq(card.userId, session.user.id)))
        .limit(1),
      DB_TIMEOUT_MS
    );
    userCard = result[0];
  } catch {
    serviceHealth.neon = false;
    return new Response("Database error", { status: 500 });
  }

  if (!userCard) {
    return new Response("Card not found or access denied", { status: 403 });
  }

  // --- Generate interactionId (AC#7, ADR-007) ---
  const interactionId = crypto.randomUUID();

  // --- Risk assessment (Story 3.2, AC#10) ---
  let riskResult: {
    score: number;
    reasoning: string;
    historyAvailable: boolean;
  };
  try {
    riskResult = await assessRisk({
      userId: session.user.id,
      cardId,
      purchaseContext,
      // priceInCents and category are NOT parsed from purchaseContext in this story.
      // Pass undefined — future story or 3.3 can add structured extraction.
    });
  } catch {
    riskResult = {
      score: 0,
      reasoning: "Risk assessment unavailable",
      historyAvailable: false,
    };
  }
  if (!riskResult.historyAvailable) {
    serviceHealth.neon = false;
  }

  // --- Tier determination (Story 3.3, AC#10) ---
  const tier = determineTier(riskResult.score);

  // --- Skeleton interaction write (AC#9, ADR-006) ---
  try {
    await withTimeout(
      db.insert(interaction).values({
        id: interactionId,
        userId: session.user.id,
        cardId,
        tier,
        riskScore: riskResult.score,
        status: "pending",
      }),
      DB_TIMEOUT_MS
    );
  } catch {
    serviceHealth.neon = false;
    return new Response("Failed to create interaction record", { status: 500 });
  }

  // --- Load Skillbook context (AC#13) ---
  // TODO(Story 3.4): Query skillbook table and pass data to wrapSkillbookContext().
  // Currently the stub always returns "" — DB query deferred to avoid wasted roundtrip.
  const skillbookContext = wrapSkillbookContext();

  // --- Build tier-aware system prompt (Story 3.3, AC#1, #2, #3, #4) ---
  const tierPrompt = TIER_PROMPTS[tier];
  const systemPrompt = skillbookContext
    ? `${tierPrompt}\n\n${skillbookContext}`
    : tierPrompt;

  // --- Stream response (AC#5, #6, #8, #11, #14, #15) ---
  // purchaseContext is prepended to model messages (not system prompt) to prevent
  // user-supplied text from being interpreted as system-level instructions.
  const modelMessages = await convertToModelMessages(
    messages as unknown as UIMessage[]
  );
  if (purchaseContext) {
    modelMessages.unshift({
      role: "user",
      content: `[Purchase context: ${purchaseContext}]`,
    });
  }

  try {
    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: modelMessages,
      prepareStep: () => {
        // On step 0: tier already configured via system parameter above.
        // On subsequent steps: maintain same tier configuration.
        // TODO(Story 4.1/5.1): Return activeTools based on tier.
        return {};
      },
      stopWhen: stepCountIs(5),
      experimental_telemetry: getGuardianTelemetry(
        interactionId,
        {
          score: riskResult.score,
          reasoning: riskResult.reasoning,
        },
        tier
      ),
      abortSignal: AbortSignal.timeout(10_000),
    });

    // --- after() callback for interaction completion (AC#9, #15, Task 4) ---
    after(async () => {
      try {
        // Wait for stream to finish — if it errored, leave status as "pending"
        try {
          await result.text;
        } catch {
          console.error(
            `[Guardian] Stream failed for interaction ${interactionId}, status left as pending`
          );
          return;
        }
        await db
          .update(interaction)
          .set({ status: "completed" })
          .where(eq(interaction.id, interactionId));
      } catch (error) {
        console.error(
          `[Guardian] Failed to update interaction ${interactionId}:`,
          error
        );
        // after() errors MUST be caught and logged, never re-thrown (ADR-006)
      }
    });

    // --- Return stream with interactionId header (AC#10) ---
    const response = result.toUIMessageStreamResponse();

    // Clone to add custom header
    const headers2 = new Headers(response.headers);
    headers2.set("x-interaction-id", interactionId);

    return new Response(response.body, {
      status: response.status,
      headers: headers2,
    });
  } catch {
    serviceHealth.gemini = false;
    return new Response("Stream initialization failed", { status: 500 });
  }
}
