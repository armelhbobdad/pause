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
import { loadUserSkillbook } from "@/lib/server/ace";
import { ANALYST_SYSTEM_PROMPT } from "@/lib/server/guardian/prompts/analyst";
import { NEGOTIATOR_SYSTEM_PROMPT } from "@/lib/server/guardian/prompts/negotiator";
import { THERAPIST_SYSTEM_PROMPT } from "@/lib/server/guardian/prompts/therapist";
import { assessRisk } from "@/lib/server/guardian/risk";
import {
  determineTier,
  type InteractionTier,
} from "@/lib/server/guardian/tiers";
import { getGuardianTelemetry, logDegradationTrace } from "@/lib/server/opik";
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

  // --- Auto-approve detection (Story 3.5) ---
  const isAutoApproved = tier === "analyst";

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
        outcome: null,
      }),
      DB_TIMEOUT_MS
    );
  } catch {
    serviceHealth.neon = false;
    return new Response("Failed to create interaction record", { status: 500 });
  }

  // --- Load Skillbook context (Story 3.4) ---
  let skillbookContext = "";
  try {
    skillbookContext = await loadUserSkillbook(session.user.id);
  } catch (error) {
    console.warn(
      "[Guardian] Skillbook loading failed, continuing without context:",
      error
    );
    serviceHealth.ace = false;
  }

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
      stopWhen: stepCountIs(isAutoApproved ? 1 : 5),
      experimental_telemetry: getGuardianTelemetry(
        interactionId,
        {
          score: riskResult.score,
          reasoning: riskResult.reasoning,
        },
        tier,
        isAutoApproved
      ),
      abortSignal: AbortSignal.timeout(10_000),
    });

    // --- after() callback for interaction completion (AC#9, #15, Task 4) ---
    after(async () => {
      try {
        // Wait for stream to finish — if it errored, leave status as "pending"
        let completedText: string;
        try {
          completedText = await result.text;
        } catch {
          console.error(
            `[Guardian] Stream failed for interaction ${interactionId}, status left as pending`
          );
          return;
        }

        // Extract reasoning summary for observability (NFR-O2)
        let reasoningSummary: string;
        if (isAutoApproved) {
          reasoningSummary = `Low-risk unlock request (score: ${riskResult.score}). Auto-approved without intervention.`;
        } else if (completedText.length <= 500) {
          reasoningSummary = completedText;
        } else {
          const spaceIdx = completedText.lastIndexOf(" ", 500);
          reasoningSummary = `${completedText.slice(0, spaceIdx === -1 ? 500 : spaceIdx)}...`;
        }

        await db
          .update(interaction)
          .set({
            status: "completed",
            ...(isAutoApproved && { outcome: "auto_approved" }),
            reasoningSummary,
          })
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

    // Clone to add custom headers
    const headers2 = new Headers(response.headers);
    // Client uses x-interaction-id to submit feedback via /api/ai/feedback (Epic 6)
    headers2.set("x-interaction-id", interactionId);
    headers2.set("x-guardian-tier", tier);
    if (isAutoApproved) {
      headers2.set("x-guardian-auto-approved", "true");
    }

    return new Response(response.body, {
      status: response.status,
      headers: headers2,
    });
  } catch (error) {
    serviceHealth.gemini = false;
    const failureReason =
      error instanceof Error ? error.message : "Unknown stream failure";
    console.error(
      `[Guardian] Degradation activated for ${interactionId}: tier=${tier}, reason=${failureReason}`
    );

    // --- Degradation telemetry (Story 3.6, AC#2, AC#4) ---
    logDegradationTrace(
      interactionId,
      tier === "analyst" ? "analyst_only" : "break_glass",
      failureReason,
      { score: riskResult.score, reasoning: riskResult.reasoning },
      tier
    );

    // --- Degradation Ladder (Story 3.6) ---
    // Level 1: Analyst-only fallback — risk assessment already completed
    if (tier === "analyst") {
      after(async () => {
        try {
          await db
            .update(interaction)
            .set({
              status: "completed",
              outcome: "auto_approved",
              reasoningSummary: `System failure — analyst_only fallback activated. Reason: ${failureReason}`,
            })
            .where(eq(interaction.id, interactionId));
        } catch (updateError) {
          console.error(
            `[Guardian] Failed to update degraded interaction ${interactionId}:`,
            updateError
          );
        }
      });

      return new Response("Looks good! Card unlocked.", {
        headers: {
          "x-interaction-id": interactionId,
          "x-guardian-tier": tier,
          "x-guardian-auto-approved": "true",
          "x-guardian-degraded": "true",
        },
      });
    }

    // Level 2: Break Glass — non-analyst tiers or risk assessment failed
    after(async () => {
      try {
        await db
          .update(interaction)
          .set({
            status: "completed",
            outcome: "break_glass",
            reasoningSummary: `System failure — break_glass fallback activated. Reason: ${failureReason}`,
          })
          .where(eq(interaction.id, interactionId));
      } catch (updateError) {
        console.error(
          `[Guardian] Failed to update degraded interaction ${interactionId}:`,
          updateError
        );
      }
    });

    return new Response("", {
      headers: {
        "x-interaction-id": interactionId,
        "x-guardian-tier": tier,
        "x-guardian-break-glass": "true",
      },
    });
  }
}
